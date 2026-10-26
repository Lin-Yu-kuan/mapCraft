import type {
  LLMProvider,
  GenerateRequest,
  PingResult,
  TokenUsage,
} from './types';
import { normalizeError } from './errors';

export interface AnthropicOptions {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  protected options: AnthropicOptions;

  constructor(options: AnthropicOptions) {
    this.options = {
      baseUrl: 'https://api.anthropic.com/v1',
      ...options,
    };
  }

  protected getEndpointUrl(): string {
    const base = (this.options.baseUrl || 'https://api.anthropic.com/v1').replace(
      /\/+$/,
      ''
    );
    return `${base}/messages`;
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      // SPEC §5.2 必備標頭，否則瀏覽器直連會被 CORS 阻斷
      'anthropic-dangerous-direct-browser-access': 'true',
      ...(this.options.headers || {}),
    };

    if (this.options.apiKey) {
      headers['x-api-key'] = this.options.apiKey;
    }

    return headers;
  }

  protected buildBody(req: GenerateRequest, stream = false): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      max_tokens: req.maxOutputTokens,
      temperature: req.temperature,
      messages: [{ role: 'user', content: req.user }],
      stream,
    };

    if (req.system) {
      body.system = req.system;
    }

    // SPEC §5.2：Anthropic 以 Tool Use 強制結構化 JSON Schema
    if (req.jsonSchema) {
      const toolName = req.schemaName || 'structured_output';
      body.tools = [
        {
          name: toolName,
          description: 'Return structured JSON matching the schema',
          input_schema: req.jsonSchema,
        },
      ];
      body.tool_choice = { type: 'tool', name: toolName };
    }

    return body;
  }

  async generate(
    req: GenerateRequest
  ): Promise<{ text: string; usage?: TokenUsage }> {
    const url = this.getEndpointUrl();
    const headers = this.getHeaders();
    const body = this.buildBody(req, false);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      throw normalizeError(err, this.id);
    }

    if (!res.ok) {
      let rawDetail: unknown;
      try {
        rawDetail = await res.json();
      } catch {
        rawDetail = await res.text();
      }
      throw normalizeError(rawDetail, this.id, res.status);
    }

    const data = await res.json();

    // 檢查是否為 Tool Use 輸出
    let text = '';
    const contentBlocks = data.content || [];
    const toolUseBlock = contentBlocks.find(
      (b: { type: string }) => b.type === 'tool_use'
    );

    if (toolUseBlock && toolUseBlock.input) {
      text =
        typeof toolUseBlock.input === 'string'
          ? toolUseBlock.input
          : JSON.stringify(toolUseBlock.input);
    } else if (contentBlocks.length > 0 && contentBlocks[0].text) {
      text = contentBlocks[0].text;
    }

    let usage: TokenUsage | undefined;
    if (data.usage) {
      usage = {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens:
          (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      };
    }

    return { text, usage };
  }

  async *stream(req: GenerateRequest): AsyncIterable<{ delta: string }> {
    const url = this.getEndpointUrl();
    const headers = this.getHeaders();
    const body = this.buildBody(req, true);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      throw normalizeError(err, this.id);
    }

    if (!res.ok) {
      let rawDetail: unknown;
      try {
        rawDetail = await res.json();
      } catch {
        rawDetail = await res.text();
      }
      throw normalizeError(rawDetail, this.id, res.status);
    }

    if (!res.body) {
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              // Anthropic SSE: content_block_delta
              if (event.type === 'content_block_delta') {
                const deltaText =
                  event.delta?.text || event.delta?.partial_json;
                if (typeof deltaText === 'string' && deltaText.length > 0) {
                  yield { delta: deltaText };
                }
              }
            } catch {
              // 忽略不完整行
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async ping(signal?: AbortSignal): Promise<PingResult> {
    const startTime = Date.now();
    try {
      await this.generate({
        system: 'Connection test',
        user: 'ping',
        temperature: 0,
        maxOutputTokens: 5,
        signal,
      });

      return {
        ok: true,
        latencyMs: Date.now() - startTime,
        modelEcho: this.options.model,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: normalizeError(err, this.id),
      };
    }
  }
}
