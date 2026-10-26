import type { PromptRequest } from '../types';

export const REPAIR_PROMPT_VERSION = 'repair.v1';

export function buildRepairPrompt(
  raw: string,
  errorMessage: string,
  schema: object
): { system: string; user: string } {
  const system = `你是 JSON 修復器。只輸出修正後的合法 JSON，不要解釋。不使用 markdown code fence。`;

  const user = `以下輸出無法通過解析或驗證，錯誤訊息：
${errorMessage}

原始輸出（可能被截斷）：
<<<RAW
${raw}
RAW>>>

請依 schema 重新輸出「完整、合法、可直接解析」的 JSON。若原輸出缺少必要欄位，請合理補齊。
JSON Schema：
${JSON.stringify(schema, null, 2)}`;

  return { system, user };
}

export function buildRepairRequest(
  raw: string,
  errorMessage: string,
  schema: object,
  signal?: AbortSignal
): PromptRequest {
  const { system, user } = buildRepairPrompt(raw, errorMessage, schema);
  return {
    system,
    user,
    temperature: 0.1, // 修復使用低溫確保精確穩定
    maxOutputTokens: 4096,
    jsonSchema: schema,
    schemaName: 'RepairedJson',
    signal,
  };
}

