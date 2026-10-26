export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateRequest {
  system: string;
  user: string;
  temperature: number;
  maxOutputTokens: number;
  /** 若 provider 支援結構化輸出，帶入 JSON Schema */
  jsonSchema?: object;
  schemaName?: string;
  signal?: AbortSignal;
}

export interface NormalizedError {
  code:
    | 'UNAUTHORIZED'
    | 'RATE_LIMIT'
    | 'CORS_OR_NETWORK'
    | 'TIMEOUT'
    | 'PROVIDER_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN';
  httpStatus?: number;
  providerId: string;
  messageForUser: string;
  raw?: unknown;
}

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  modelEcho?: string;
  error?: NormalizedError;
}

export interface ModelRecommendation {
  id: string;
  name: string;
  role: 'map' | 'lesson' | 'both';
  description?: string;
}

export interface ProviderMeta {
  id: string;
  name: string;
  defaultBaseUrl: string;
  recommendedModels: ModelRecommendation[];
  isDirectBrowserSupported: boolean;
  requiresDirectBrowserHeader?: boolean;
  requiresCustomOriginsNotice?: boolean;
  supportsJsonSchema: boolean;
  docUrl?: string;
}

export interface LLMProvider {
  readonly id: string;
  /** 一次性輸出（用於地圖 JSON） */
  generate(req: GenerateRequest): Promise<{ text: string; usage?: TokenUsage }>;
  /** 串流（用於教材）；沒有串流能力的 provider 可回退為單一 chunk */
  stream(req: GenerateRequest): AsyncIterable<{ delta: string }>;
  /** 連線測試 */
  ping(signal?: AbortSignal): Promise<PingResult>;
}
