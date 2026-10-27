import type { PromptRequest } from '../types';

export const LESSON_PROMPT_VERSION = 'lesson.zh-TW.v1';

export const LESSON_JSON_SCHEMA = {
  type: 'object',
  properties: {
    concept: {
      type: 'string',
      description: '白話解釋（150-400字），先一句話定義，再說明運作原理與使用時機',
    },
    why: {
      type: 'string',
      description: '1-3句說明解決了什麼問題、不學會遇到什麼麻煩',
    },
    example: {
      type: 'object',
      properties: {
        scenario: { type: 'string', description: '貼近實務的應用情境' },
        code: { type: 'string', description: '程式碼範例（純文字，不含 markdown 圍欄）' },
        language: { type: 'string', description: '程式語言名稱（例 typescript, python）' },
        explain: { type: 'string', description: '這段範例的執行重點' },
      },
      required: ['scenario', 'explain'],
    },
    pitfalls: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4條新手最常搞錯的誤區（每條一句話）',
    },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5條可背誦的精華重點',
    },
    quiz: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '一題測驗是否真正理解的單選題' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '4個選項',
        },
        answerIndex: { type: 'number', description: '正解索引（0-3）' },
        explanation: { type: 'string', description: '說明為何正解正確與其他選項錯誤' },
      },
      required: ['question', 'options', 'answerIndex', 'explanation'],
    },
  },
  required: ['concept', 'why', 'pitfalls', 'keyPoints'],
};

export interface LessonPromptParams {
  mapTitle: string;
  pathLabels: string; // 例如：Docker > 核心觀念 > Dockerfile 實作
  level: string;
  nodeLabel: string;
  nodeSummary: string;
  goal?: string;
  siblingLabels?: string[];
}

export function buildLessonPrompt(params: LessonPromptParams): { system: string; user: string } {
  const system = `你是使用繁體中文（台灣用語）的專業導師。你的任務是讓一個非專家在 3 分鐘內真正理解一個知識點。
你只輸出 JSON。不得出現簡體字。專有名詞第一次出現時附上英文原文。`;

  const goalText = params.goal ? `學習目標：${params.goal}\n` : '';
  const siblingsText =
    params.siblingLabels && params.siblingLabels.length > 0
      ? `同層其他主題包含：${params.siblingLabels.join('、')}。（請專注於本節點，避免詳細解釋同層其他節點的範疇）\n`
      : '';

  const user = `學習主題：${params.mapTitle}
${goalText}所在路徑：${params.pathLabels}
學習者程度：${params.level}
知識點：${params.nodeLabel}
知識點摘要：${params.nodeSummary}
${siblingsText}
請產出以下欄位（皆為繁體中文）：
- concept：150–400 字白話解釋。先用一句話定義，再說明運作原理，最後說明「什麼時候會用到」。
- why：1–3 句，說明它解決了什麼問題、不學它會遇到什麼麻煩。
- example：一個貼近實務的情境；若有程式碼，code 放程式碼（不含 markdown 圍欄），language 填語言名稱；explain 說明這段範例的重點。
- pitfalls：2–4 條新手最常搞錯的地方（每條一句話，具體、不要空泛）。
- keyPoints：3–5 條可背誦的重點。
- quiz：一題四選一的單選題，測「是否真的理解」而非背誦；answerIndex 為正解索引（0–3）；explanation 說明為何其他選項錯。

限制：不要超過 1200 字；不要重複 concept 的內容到 keyPoints；不要提供需付費才能驗證的資訊。

JSON Schema：
${JSON.stringify(LESSON_JSON_SCHEMA, null, 2)}`;

  return { system, user };
}

export function buildLessonRequest(
  params: LessonPromptParams,
  temperature = 0.3,
  signal?: AbortSignal
): PromptRequest {
  const { system, user } = buildLessonPrompt(params);
  return {
    system,
    user,
    temperature,
    maxOutputTokens: 3000,
    jsonSchema: LESSON_JSON_SCHEMA,
    schemaName: 'LessonContent',
    signal,
  };
}
