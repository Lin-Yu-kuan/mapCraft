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

const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_EXPRESS_BASE_URL =
  'https://aiplatform.googleapis.com/v1beta1/publishers/google';

const DEFAULT_VERTEX_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

function sanitizeSchemaForGemini(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchemaForGemini);
  }

  const obj = { ...(schema as Record<string, unknown>) };

  if (obj.properties && typeof obj.properties === 'object') {
    const newProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(
      obj.properties as Record<string, unknown>
    )) {
      newProps[k] = sanitizeSchemaForGemini(v);
    }
    obj.properties = newProps;
  }

  if (obj.type === 'array') {
    if (obj.items) {
      obj.items = sanitizeSchemaForGemini(obj.items);
    } else {
      obj.items = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          summary: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
          },
        },
        required: ['id', 'label', 'summary', 'difficulty'],
      };
    }
  }

  return obj;
}

export class GoogleGeminiProvider implements LLMProvider {
  readonly id = 'google';
  protected options: GoogleGeminiOptions;

  constructor(options: GoogleGeminiOptions) {
    this.options = {
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      ...options,
    };
  }

  protected isAqKey(): boolean {
    return Boolean(
      this.options.apiKey && this.options.apiKey.trim().startsWith('AQ.')
    );
  }

  protected isDefaultBaseUrl(): boolean {
    const raw = (this.options.baseUrl || '').trim().replace(/\/+$/, '');
    return !raw || raw === DEFAULT_GEMINI_BASE_URL;
  }

  protected normalizeModelId(rawModel: string): string {
    const cleaned = rawModel
      .trim()
      .replace(/^publishers\/google\/models\//, '')
      .replace(/^models\//, '');

    if (cleaned === 'gemini-3.8-flash') return 'gemini-2.5-flash';
    if (cleaned === 'gemini-3.8-pro') return 'gemini-2.5-pro';
    return cleaned || 'gemini-2.5-flash';
  }

  protected formatBaseUrl(rawBase?: string): string {
    const base = (rawBase || DEFAULT_GEMINI_BASE_URL)
      .trim()
      .replace(/\/+$/, '');

    if (
      base.includes('aiplatform.googleapis.com') &&
      !base.includes('/publishers/')
    ) {
      if (base.endsWith('/v1') || base.endsWith('/v1beta1')) {
        return `${base}/publishers/google`;
      }
      if (base.endsWith('aiplatform.googleapis.com')) {
        return `${base}/v1beta1/publishers/google`;
      }
    }

    return base;
  }

  protected getEndpointUrl(stream = false, overrideBaseUrl?: string): string {
    let base: string;
    if (overrideBaseUrl) {
      base = this.formatBaseUrl(overrideBaseUrl);
    } else if (this.isDefaultBaseUrl() && this.isAqKey()) {
      base = VERTEX_EXPRESS_BASE_URL;
    } else {
      base = this.formatBaseUrl(this.options.baseUrl);
    }

    const model = encodeURIComponent(this.normalizeModelId(this.options.model));

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
      headers['x-goog-api-key'] = this.options.apiKey.trim();
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
        responseSchema: sanitizeSchemaForGemini(req.jsonSchema),
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
    const canFallbackAq = this.isDefaultBaseUrl() && this.isAqKey();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      if (canFallbackAq) {
        const fallbackUrl = this.getEndpointUrl(false, DEFAULT_GEMINI_BASE_URL);
        try {
          res = await fetch(fallbackUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: req.signal,
          });
        } catch (fallbackErr) {
          throw normalizeError(fallbackErr, this.id);
        }
      } else {
        throw normalizeError(err, this.id);
      }
    }

    if (
      !res.ok &&
      canFallbackAq &&
      (res.status === 400 ||
        res.status === 401 ||
        res.status === 403 ||
        res.status === 404)
    ) {
      const fallbackUrl = this.getEndpointUrl(false, DEFAULT_GEMINI_BASE_URL);
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: req.signal,
        });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch {
        // 保留原始回應錯誤供下方解析
      }
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
    const canFallbackAq = this.isDefaultBaseUrl() && this.isAqKey();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      if (canFallbackAq) {
        const fallbackUrl = this.getEndpointUrl(true, DEFAULT_GEMINI_BASE_URL);
        try {
          res = await fetch(fallbackUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: req.signal,
          });
        } catch (fallbackErr) {
          throw normalizeError(fallbackErr, this.id);
        }
      } else {
        throw normalizeError(err, this.id);
      }
    }

    if (
      !res.ok &&
      canFallbackAq &&
      (res.status === 400 ||
        res.status === 401 ||
        res.status === 403 ||
        res.status === 404)
    ) {
      const fallbackUrl = this.getEndpointUrl(true, DEFAULT_GEMINI_BASE_URL);
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: req.signal,
        });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch {
        // 保留原始回應錯誤
      }
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
        modelEcho: this.normalizeModelId(this.options.model),
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
    const base = this.formatBaseUrl(this.options.baseUrl);
    const isVertexEndpoint =
      base.includes('aiplatform.googleapis.com') ||
      (this.isDefaultBaseUrl() && this.isAqKey());

    const url = isVertexEndpoint
      ? `${DEFAULT_GEMINI_BASE_URL}/models`
      : `${base}/models`;
    const headers = this.getHeaders();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers,
        signal,
      });
    } catch (err) {
      if (isVertexEndpoint) {
        return [...DEFAULT_VERTEX_MODELS];
      }
      throw normalizeError(err, this.id);
    }

    if (!res.ok) {
      if (isVertexEndpoint) {
        return [...DEFAULT_VERTEX_MODELS];
      }
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
      return isVertexEndpoint ? [...DEFAULT_VERTEX_MODELS] : [];
    }

    return data.models
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string }) =>
        m.name
          .replace(/^publishers\/google\/models\//, '')
          .replace(/^models\//, '')
      )
      .sort((a: string, b: string) => {
        // 優先將 flash 排在前面，pro 其次
        const aFlash = a.includes('flash') ? 0 : 1;
        const bFlash = b.includes('flash') ? 0 : 1;
        if (aFlash !== bFlash) return aFlash - bFlash;
        return a.localeCompare(b);
      });
  }
}
