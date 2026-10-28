import type {
  LLMProvider,
  GenerateRequest,
  PingResult,
  TokenUsage,
} from './types';
import { normalizeError } from './errors';

export interface OpenAICompatibleOptions {
  id?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
  azure?: { apiVersion: string; deployment: string };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  protected options: OpenAICompatibleOptions;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.id || 'openai';
    this.options = { ...options };
  }

  /**
   * 取得完整的 Chat Completions 端點 URL
   */
  protected getEndpointUrl(): string {
    const { baseUrl, id, azure } = this.options;
    const cleanBase = baseUrl.replace(/\/+$/, '');

    // Azure OpenAI 特殊 URL 格式（SPEC §5.2）
    if (id === 'azure' && azure?.deployment) {
      const apiVer = azure.apiVersion || '2024-08-01-preview';
      return `${cleanBase}/openai/deployments/${encodeURIComponent(
        azure.deployment
      )}/chat/completions?api-version=${encodeURIComponent(apiVer)}`;
    }

    return `${cleanBase}/chat/completions`;
  }

  /**
   * 取得請求標頭（包含認證與自訂標頭）
   */
  protected getHeaders(): Record<string, string> {
    const { id, apiKey, headers } = this.options;
    const result: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    if (apiKey) {
      if (id === 'azure') {
        result['api-key'] = apiKey;
      } else {
        result['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    // OpenRouter 可選推薦標頭
    if (id === 'openrouter') {
      if (!result['HTTP-Referer']) {
        result['HTTP-Referer'] = 'https://mapcraft.dev';
      }
      if (!result['X-Title']) {
        result['X-Title'] = 'MapCraft';
      }
    }

    return result;
  }

  /**
   * 構造請求 Body
   */
  protected buildBody(req: GenerateRequest, stream = false): Record<string, unknown> {
    const { id, model } = this.options;
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature,
      max_tokens: req.maxOutputTokens,
      stream,
    };

    // 依供應商支援程度注入結構化輸出（SPEC §5.2）
    if (req.jsonSchema) {
      if (id === 'deepseek') {
        // DeepSeek 僅支援 json_object 模式
        body.response_format = { type: 'json_object' };
      } else if (id === 'ollama') {
        // Ollama 原生支援 format: object
        body.format = req.jsonSchema;
      } else {
        // OpenAI / Azure / OpenRouter / Custom
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: req.schemaName || 'output',
            schema: req.jsonSchema,
            strict: true,
          },
        };
      }
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
    const text = data.choices?.[0]?.message?.content || '';

    let usage: TokenUsage | undefined;
    if (data.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
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
          if (!trimmed || trimmed.startsWith(':')) continue; // 略過註解或心跳
          if (trimmed === 'data: [DONE]') return;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                yield { delta };
              }
            } catch {
              // 忽略不完整的 JSON 行，留待後續累積
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
        system: 'You are a connection tester.',
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

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const cleanBase = this.options.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/models`;
    const headers = this.getHeaders();
    try {
      const res = await fetch(url, { headers, signal });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data.data)) {
        return data.data
          .map((m: { id?: string }) => m.id || '')
          .filter((id: string) => id.length > 0)
          .sort();
      }
      return [];
    } catch {
      return [];
    }
  }
}
