import type { PromptRequest } from '../types';
import type { PredecessorSummary } from '../tree';

export type { PredecessorSummary };

export const LESSON_PROMPT_VERSION = 'lesson.zh-TW.v2';

export const LESSON_JSON_SCHEMA = {
  type: 'object',
  properties: {
    markdown: {
      type: 'string',
      description:
        '引導式學習筆記正文（Markdown 格式）。請依知識點性質自由編排最適合的教學結構，靈活運用生活化例子、Markdown 比較表格、```diagram 圖解流程圖、引用提示與精簡範例。段落間必須以空行（\\n\\n）清楚分隔，嚴禁將所有文字擠在同一段。',
    },
    quiz: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '一題測驗是否真正理解的情境單選題' },
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
  required: ['markdown', 'quiz'],
};

export interface LessonPromptParams {
  mapTitle: string;
  pathLabels: string; // 例如：Docker > 核心觀念 > Dockerfile 實作
  level: string;
  nodeLabel: string;
  nodeSummary: string;
  goal?: string;
  siblingLabels?: string[];
  childLabels?: string[];
  predecessors?: PredecessorSummary[]; // 方案 2：前置節點摘要鏈（承先啟後脈絡）
}

export function buildLessonPrompt(params: LessonPromptParams): { system: string; user: string } {
  const system = `你是使用繁體中文（台灣用語）的啟發式教學導師。你的任務是用最符合人類直覺的「引導式學習法」，帶領學習者輕鬆搞懂當前節點。
你只輸出 JSON。不得出現簡體字。專有名詞第一次出現時附上英文原文。`;

  const goalText = params.goal ? `學習目標：${params.goal}\n` : '';
  const siblingsText =
    params.siblingLabels && params.siblingLabels.length > 0
      ? `同層其他節點：${params.siblingLabels.join('、')}（請專注於本節點，不要越界詳述同層其他節點的內容）\n`
      : '';
  const childrenText =
    params.childLabels && params.childLabels.length > 0
      ? `本節點底下的子節點：${params.childLabels.join('、')}（⚠️ 防劇透重要規則：本節點是上層導覽，請只建立高層次直覺與全貌，絕對不要提前深入解釋上述子節點的專有名詞或底層細節，把細節留給子節點！）\n`
      : '';

  let predecessorsText = '';
  if (params.predecessors && params.predecessors.length > 0) {
    const lines = params.predecessors.map((p) => {
      const roleName = p.role === 'parent' ? '【上層總綱】' : '【前一單元】';
      return `  • ${roleName} ${p.label}：${p.summary}`;
    });
    predecessorsText = `【學習者已掌握的前置知識脈絡】：\n${lines.join('\n')}\n👉 【教學銜接指示】：請在教學開頭用 1～2 句話自然承接上述已學概念作為鋪墊，再帶出本節點的核心，讓學習流暢連貫，避免硬塞或孤立解釋專有名詞！\n\n`;
  }

  const user = `學習主題：${params.mapTitle}
${goalText}所在路徑：${params.pathLabels}
學習者程度：${params.level}
當前節點：${params.nodeLabel}
節點目標：${params.nodeSummary}
${siblingsText}${childrenText}${predecessorsText}
請產出 JSON，包含兩個必填欄位：
1. \`markdown\`：以 AI 認為最適合該知識點的「引導式教學」自由發揮（不限死板欄位，不要寫成八股填空）。
   - 【循序漸進、拒絕硬塞專有名詞】：先從學習者懂的日常直覺或痛點切入，不要在第一段就塞滿後面才會學到的專有名詞。
   - 【強制分段與排版呼吸感】：每段最多 2～4 句話，段落與段落之間**必須空行（\\n\\n）**，絕不可把大段文字擠在一起！善用 \`##\` / \`###\` 自訂最適合的小標題與 **粗體** 重點。
   - 【多元視覺化解釋工具箱】（請依主題特性自由挑選最適合的 2～3 種呈現方式）：
     • 🍎 **生活化比喻**：用日常場景把抽象概念具象化。
     • 📊 **Markdown 表格**：比較新舊做法、優缺點或易混淆觀念時，畫出 \`| 欄位 | 說明 |\` 表格。
     • 🗺️ **結構圖／流程圖**：解釋運作流程、架構或步驟時，請使用 \`\`\`diagram 圍欄畫出清晰的 ASCII / 方塊箭頭圖（例如 \`[前端] ──請求──> [API] ──查詢──> [DB]\`）。
     • 💻 **實戰小範例**：若是語法或實作主題，給出精簡好懂的範例並點出關鍵。
     • 💡 **微思考或避坑提示**：用 \`> 💡 ...\` 引用塊點出關鍵直覺或常見盲點。
2. \`quiz\`：每個節點必備的一題四選一隨堂練習，測驗「是否真正理解觀念」而非死背；\`answerIndex\` 為正解索引（0–3）；\`explanation\` 說明正解原因與其他選項為何不對。

限制：\`markdown\` 長度約 300–900 字，重質不重量；不要提供需付費才能驗證的資訊。

JSON Schema：
${JSON.stringify(LESSON_JSON_SCHEMA, null, 2)}`;

  return { system, user };
}

export function buildLessonRequest(
  params: LessonPromptParams,
  temperature = 0.4,
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
