import type { PromptRequest } from '../types';

export const BRAINSTORM_PROMPT_VERSION = 'brainstorm.zh-TW.v1';

export const BRAINSTORM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    coreIdea: {
      type: 'string',
      description: '💡 核心創意（150-400字）：富有啟發性的創新點子、核心突破角度或獨特切入點',
    },
    useCases: {
      type: 'array',
      items: { type: 'string' },
      description: '🎯 應用情境（2-5條）：具體的落地實例、實際生活或專案場景',
    },
    challenges: {
      type: 'array',
      items: { type: 'string' },
      description: '⚠️ 潛在挑戰（2-4條）：執行時可能遭遇的瓶頸、盲區或限制',
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: '🚀 下一步行動（2-4條）：立即可以著手驗證或執行的具體行動建議',
    },
  },
  required: ['coreIdea', 'useCases', 'challenges', 'nextSteps'],
};

export interface BrainstormPromptParams {
  mapTitle: string;
  pathLabels: string;
  level: string;
  nodeLabel: string;
  nodeSummary: string;
  goal?: string;
  siblingLabels?: string[];
}

export function buildBrainstormPrompt(params: BrainstormPromptParams): { system: string; user: string } {
  const system = `你是充滿創意與實務洞察力的 AI 腦力激盪教練。你的任務是針對特定主題與節點，提供極具啟發性、跳脫常規且兼具可行性的創新想法。
你只輸出 JSON。不得出現簡體字。專有名詞第一次出現時附上英文原文。`;

  const goalText = params.goal ? `目標與期望成果：${params.goal}\n` : '';
  const siblingsText =
    params.siblingLabels && params.siblingLabels.length > 0
      ? `同層其他分支包含：${params.siblingLabels.join('、')}。（請專注於本節點，避免詳細解釋同層兄弟節點的範疇）\n`
      : '';

  const user = `主題：${params.mapTitle}
${goalText}所在路徑：${params.pathLabels}
深度層級：${params.level}
當前節點：${params.nodeLabel}
節點綱要：${params.nodeSummary}
${siblingsText}
請依照以下固定發想框架產出創意思考（皆為繁體中文）：
- coreIdea：💡 核心創意（150–400 字）：針對此主題有什麼大膽、新穎或打破常規的想法或解法？
- useCases：🎯 應用情境（2–5 條）：此點子可以在哪些真實世界場景、業務模式或產品中落地？
- challenges：⚠️ 潛在挑戰（2–4 條）：落實時可能遭遇的技術困難、心理阻力或資源限制？
- nextSteps：🚀 下一步行動（2–4 條）：今天或這週就可以進行的第一步低成本驗證行動。

JSON Schema：
${JSON.stringify(BRAINSTORM_JSON_SCHEMA, null, 2)}`;

  return { system, user };
}

export function buildBrainstormRequest(
  params: BrainstormPromptParams,
  temperature = 0.7,
  signal?: AbortSignal
): PromptRequest {
  const { system, user } = buildBrainstormPrompt(params);
  return {
    system,
    user,
    temperature,
    maxOutputTokens: 2500,
    jsonSchema: BRAINSTORM_JSON_SCHEMA,
    schemaName: 'BrainstormContent',
    signal,
  };
}
