import type {
  LLMProvider,
  GenerateRequest,
  PingResult,
  TokenUsage,
} from './types';
import { normalizeError } from './errors';

export interface GoogleGeminiOptions {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
}

export class GoogleGeminiProvider implements LLMProvider {
  readonly id = 'google';
  protected options: GoogleGeminiOptions;

  constructor(options: GoogleGeminiOptions) {
    this.options = {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      ...options,
    };
  }

  protected getEndpointUrl(stream = false): string {
    const base = (
      this.options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');
    const model = encodeURIComponent(this.options.model);

    if (stream) {
      return `${base}/models/${model}:streamGenerateContent?alt=sse`;
    }
    return `${base}/models/${model}:generateContent`;
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.options.headers || {}),
    };

    if (this.options.apiKey) {
      headers['x-goog-api-key'] = this.options.apiKey;
    }

    return headers;
  }

  protected buildBody(req: GenerateRequest): Record<string, unknown> {
    const genConfig: Record<string, unknown> = {
      temperature: req.temperature,
      maxOutputTokens: req.maxOutputTokens,
    };

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.user }],
        },
      ],
      generationConfig: genConfig,
    };

    if (req.system) {
      body.systemInstruction = {
        parts: [{ text: req.system }],
      };
    }

    // SPEC §5.2：Gemini 原生 responseSchema
    if (req.jsonSchema) {
      body.generationConfig = {
        ...(body.generationConfig as object),
        responseMimeType: 'application/json',
        responseSchema: req.jsonSchema,
      };
    }

    return body;
  }

  async generate(
    req: GenerateRequest
  ): Promise<{ text: string; usage?: TokenUsage }> {
    const url = this.getEndpointUrl(false);
    const headers = this.getHeaders();
    const body = this.buildBody(req);

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
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let usage: TokenUsage | undefined;
    if (data.usageMetadata) {
      usage = {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      };
    }

    return { text, usage };
  }

  async *stream(req: GenerateRequest): AsyncIterable<{ delta: string }> {
    const url = this.getEndpointUrl(true);
    const headers = this.getHeaders();
    const body = this.buildBody(req);

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
              const delta =
                event.candidates?.[0]?.content?.parts?.[0]?.text;
              if (typeof delta === 'string' && delta.length > 0) {
                yield { delta };
              }
            } catch {
              // 忽略不完整 JSON 行
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
        maxOutputTokens: 20,
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
    const base = (
      this.options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');
    const url = `${base}/models`;
    const headers = this.getHeaders();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers,
        signal,
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
    if (!Array.isArray(data.models)) {
      return [];
    }

    return data.models
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string }) => m.name.replace(/^models\//, ''))
      .sort((a: string, b: string) => {
        // 優先將 flash 排在前面，pro 其次
        const aFlash = a.includes('flash') ? 0 : 1;
        const bFlash = b.includes('flash') ? 0 : 1;
        if (aFlash !== bFlash) return aFlash - bFlash;
        return a.localeCompare(b);
      });
  }
}
