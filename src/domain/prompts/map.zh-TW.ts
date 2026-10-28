import type { GenerationOptions, PromptRequest } from '../types';

export const MAP_PROMPT_VERSION = 'map.zh-TW.v1';

export const MAP_GENERATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '地圖標題' },
    summary: { type: 'string', description: '一句話說明學完後能掌握什麼能力' },
    nodes: {
      type: 'array',
      description: '第一層核心知識模組',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '例如 "1", "2"' },
          label: { type: 'string', description: '節點標題，20字內，具體知識點' },
          summary: { type: 'string', description: '一句話說明學會這個能解決什麼' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          estMinutes: { type: 'number', description: '預估學習分鐘數（5-180）' },
          children: {
            type: 'array',
            description: '子節點',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                summary: { type: 'string' },
                difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                estMinutes: { type: 'number' },
                children: { type: 'array' },
              },
              required: ['id', 'label', 'summary', 'difficulty'],
            },
          },
        },
        required: ['id', 'label', 'summary', 'difficulty'],
      },
    },
  },
  required: ['title', 'summary', 'nodes'],
};

export function buildMapPrompt(topic: string, options: GenerationOptions): { system: string; user: string } {
  const system = `你是資深課程設計師，擅長把任何主題拆解成可由淺入深、可直接照著學的學習地圖。
你只輸出 JSON，不輸出任何說明文字、不使用 markdown code fence。`;

  const levelDescText = options.levelDescription?.trim()
    ? `\n程度背景補充：${options.levelDescription.trim()}`
    : '';

  const user = `<<<LEARNER_INPUT
主題：${topic.trim()}
目前程度：${options.level}（beginner=完全沒接觸 / some=看過文章 / advanced=做過專案）${levelDescText}
學習目標：${options.goal?.trim() || '全面系統化掌握此主題'}
可用總時間：${options.timeBudgetHours ?? 10} 小時
語言：繁體中文（台灣用語）
LEARNER_INPUT>>>

規劃限制：
- 深度最多 ${options.maxDepth} 層；每層最多 ${options.maxBreadth} 個節點；總節點數不超過 ${options.maxNodes}。
- 節點標題 ≤ 20 字，必須是可學習的知識點（禁止「簡介」「其他」「延伸閱讀」）。
- summary 用一句話說明「學會這個能解決什麼問題或能做什麼」。
- 節點順序代表學習順序，後面的節點可以依賴前面的節點。
- 難度依實際認知負荷標註（beginner/intermediate/advanced），不要全部標 beginner。
- 不要產生行銷語、空泛描述、或需要付費課程才能理解的內容。

輸出規則：
1. 只輸出符合下方 schema 的 JSON 物件。
2. id 規則：第一層 "1"、"2"；第二層 "1.1"、"1.2"；以此類推。
3. 不要有 JSON 以外的任何字元。

JSON Schema：
${JSON.stringify(MAP_GENERATION_JSON_SCHEMA, null, 2)}`;

  return { system, user };
}

export function buildMapRequest(
  topic: string,
  options: GenerationOptions,
  signal?: AbortSignal
): PromptRequest {
  const { system, user } = buildMapPrompt(topic, options);
  return {
    system,
    user,
    temperature: options.temperature ?? 0.4,
    maxOutputTokens: 4096,
    jsonSchema: MAP_GENERATION_JSON_SCHEMA,
    schemaName: 'MapGenerationResponse',
    signal,
  };
}
