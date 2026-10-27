import type { PromptRequest, NodeMode } from '../types';

export const SUBTREE_PROMPT_VERSION = 'subtree.zh-TW.v1';

export const SUBTREE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    children: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: '節點名稱（<= 20 字）' },
          summary: { type: 'string', description: '一句話摘要（說明掌握這個節點的價值或核心點子）' },
          difficulty: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
          },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: '子節點名稱' },
                summary: { type: 'string', description: '一句話摘要' },
                difficulty: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced'],
                },
              },
              required: ['label', 'summary', 'difficulty'],
            },
          },
        },
        required: ['label', 'summary', 'difficulty'],
      },
    },
  },
  required: ['children'],
};

export interface SubtreePromptParams {
  mapTitle: string;
  pathLabels: string;
  currentNodeLabel: string;
  currentNodeSummary: string;
  mode: NodeMode;
  depth: number;
  breadth: number;
  existingChildrenLabels?: string[];
  goal?: string;
}

export function buildSubtreePrompt(params: SubtreePromptParams): { system: string; user: string } {
  const isBrainstorm = params.mode === 'brainstorm';

  const system = isBrainstorm
    ? `你是極具創意發想能力的創新教練。你的任務是針對給定的主題節點，延伸發想出一組富有創意、突破常規且彼此獨立的子方向。
你只輸出 JSON。不得出現簡體字。`
    : `你是使用繁體中文（台灣用語）的專業學習架構規劃師。你的任務是針對特定知識點，向下拆解出循序漸進、結構清晰的子分支。
你只輸出 JSON。不得出現簡體字。`;

  const existingText =
    params.existingChildrenLabels && params.existingChildrenLabels.length > 0
      ? `目前已有的子分支包含：${params.existingChildrenLabels.join('、')}。（請勿產出重複或高度雷同的內容）\n`
      : '';

  const goalText = params.goal ? `學習目標與期望：${params.goal}\n` : '';

  const instructionText = isBrainstorm
    ? `請為當前節點發想新的創意子分支：
- 發想模式：腦力激盪模式（探索新應用、交叉混搭、未來趨勢或大膽嘗試）
- 廣度：請嚴格產出 ${params.breadth} 個平行子方向
- 深度：最大層級深度為 ${params.depth} 層（若深度為 1 則 children 底下不要再有第二層 children）
- label：簡潔有力（<= 20 字）
- summary：一句話點出該點子的獨特之處或核心價值`
    : `請為當前節點拆解出專業的學習子分支：
- 模式：學習掌握架構模式（由淺入深、概念到實作）
- 廣度：請嚴格產出 ${params.breadth} 個平行子主題
- 深度：最大層級深度為 ${params.depth} 層（若深度為 1 則 children 底下不要再有第二層 children）
- label：精確的專業概念名稱（<= 20 字）
- summary：一句話說明學會這個主題能解決什麼問題`;

  const user = `整體地圖主題：${params.mapTitle}
${goalText}當前節點完整路徑：${params.pathLabels}
當前目標節點：${params.currentNodeLabel}
目標節點綱要：${params.currentNodeSummary}
${existingText}
${instructionText}

JSON Schema：
${JSON.stringify(SUBTREE_JSON_SCHEMA, null, 2)}`;

  return { system, user };
}

export function buildSubtreeRequest(
  params: SubtreePromptParams,
  temperature = 0.5,
  signal?: AbortSignal
): PromptRequest {
  const { system, user } = buildSubtreePrompt(params);
  return {
    system,
    user,
    temperature: params.mode === 'brainstorm' ? 0.8 : temperature,
    maxOutputTokens: 2500,
    jsonSchema: SUBTREE_JSON_SCHEMA,
    schemaName: 'SubtreeGenerationResponse',
    signal,
  };
}
