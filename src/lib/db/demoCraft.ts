import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';
import { mapsRepo } from './repos/maps';
import { progressRepo } from './repos/progress';
import { lessonsRepo } from './repos/lessons';

export const DEMO_MAP_ID = 'demo-typescript-craft';

export const DEMO_MAP: LearningMap = {
  id: DEMO_MAP_ID,
  schemaVersion: 1,
  title: 'TypeScript 核心架構與實戰精粹',
  topic: 'TypeScript',
  summary: '掌握型別系統思維、泛型設計與實戰技巧',
  providerId: 'openai',
  modelId: 'gpt-4o-mini',
  createdAt: Date.now() - 3600000,
  updatedAt: Date.now(),
  options: {
    maxDepth: 3,
    maxBreadth: 4,
    maxNodes: 20,
    temperature: 0.4,
    level: 'beginner',
    language: 'zh-TW',
  },
  root: {
    id: '0',
    label: 'TypeScript 核心體系',
    summary: 'JavaScript 的強型別超集，提供靜態型別分析與大型專案架構維護能力',
    difficulty: 'beginner',
    estMinutes: 20,
    mode: 'learning',
    children: [
      {
        id: '1',
        label: '型別系統基石',
        summary: '原始型別、型別推斷、聯合型別與型別縮小（Narrowing）',
        difficulty: 'beginner',
        estMinutes: 25,
        mode: 'learning',
        children: [
          {
            id: '1.1',
            label: '型別收窄（Type Narrowing）',
            summary: '利用 typeof、instanceof 與自訂 Type Guard 保護執行階段邏輯',
            difficulty: 'intermediate',
            estMinutes: 20,
            mode: 'learning',
            children: [],
          },
          {
            id: '1.2',
            label: '可辨識聯合（Discriminated Unions）',
            summary: '使用可辨識聯合模式建構無懈可擊的狀態機與資料流',
            difficulty: 'intermediate',
            estMinutes: 25,
            mode: 'learning',
            children: [],
          },
        ],
      },
      {
        id: '2',
        label: '泛型與高階型別編程',
        summary: '提升程式碼復用性與靈活度的抽象利器',
        difficulty: 'intermediate',
        estMinutes: 30,
        mode: 'learning',
        children: [
          {
            id: '2.1',
            label: '泛型約束（Generic Constraints）',
            summary: '使用 extends 關鍵字限定泛型範圍與屬性特徵',
            difficulty: 'intermediate',
            estMinutes: 20,
            mode: 'learning',
            children: [],
          },
          {
            id: '2.2',
            label: '條件型別與 infer 關鍵字',
            summary: '在型別層級實現條件分支判斷與回傳型別解構',
            difficulty: 'advanced',
            estMinutes: 35,
            mode: 'learning',
            children: [],
          },
        ],
      },
      {
        id: '3',
        label: '工程化與嚴格實戰',
        summary: 'tsconfig 嚴格模式最佳設定與大型團隊協作規範',
        difficulty: 'advanced',
        estMinutes: 20,
        mode: 'learning',
        children: [],
      },
    ],
  },
};

export const DEMO_PROGRESS: NodeProgress[] = [
  {
    mapId: DEMO_MAP_ID,
    nodeId: '0',
    status: 'done',
    attempts: 1,
    correct: 1,
    updatedAt: Date.now() - 1800000,
  },
  {
    mapId: DEMO_MAP_ID,
    nodeId: '1',
    status: 'todo',
    attempts: 0,
    correct: 0,
    updatedAt: Date.now() - 1800000,
  },
];

export const DEMO_LESSONS: Lesson[] = [
  {
    mapId: DEMO_MAP_ID,
    nodeId: '0',
    schemaVersion: 1,
    modelId: 'demo-preloaded',
    promptVersion: 'lesson.zh-TW.v2',
    mode: 'learning',
    createdAt: Date.now() - 3600000,
    content: {
      markdown: `## 🍎 先用一個生活比喻來理解

想像你在組裝一套大型樂高模型。

如果沒有說明書與卡榫防呆設計（就像傳統的 **JavaScript**），你把零件插錯位置時當下完全不會發現，直到整台車組好、通電開動的那一刻，車輪才當場飛出去。

**TypeScript** 就像是在你的工作桌上裝了一台「即時雷射掃描儀」——當你拿起零件準備拼上去的那一秒，它就會立刻提醒你：「這個卡榫尺寸不合喔！」讓你在動手執行前就把問題修好。

## 🗺️ TypeScript 是怎麼運作的？

很多人第一次接觸時會擔心：「瀏覽器又看不懂 TypeScript，這樣網頁怎麼跑？」

其實 TypeScript 只在「開發與打包階段」幫你把關，最終放到瀏覽器上跑的依然是純粹的 JavaScript：

\`\`\`diagram
[你寫的 .ts 程式碼]
       │
       ▼  1. 靜態型別檢查（抓出打錯字、型別不合）
[TypeScript 編譯器]
       │
       ▼  2. 型別抹除（Type Erasure：剝除所有型別標記）
[純淨的 .js 程式碼] ──> 交給瀏覽器或 Node.js 高速執行（零額外效能開銷）
\`\`\`

## 📊 JavaScript vs TypeScript 一眼看懂

| 比較項目 | JavaScript (JS) | TypeScript (TS) |
| :--- | :--- | :--- |
| **發現錯誤的時機** | 程式跑到那一行才爆炸（執行期） | 寫程式當下編輯器立刻劃紅線（編譯期） |
| **團隊協作體驗** | 要去翻別人的程式碼才知道參數長怎樣 | 滑鼠移過去就有完整結構提示與自動補全 |
| **執行時期速度** | 原生速度 | **一模一樣**（因為編譯後型別全被抹除了） |

> 💡 **接下來的學習路線**：在這張地圖中，我們會先從「型別系統基石」認識基本防呆工具，再進入「泛型」學習如何寫出靈活又不失安全性的程式碼。`,
      quiz: {
        question:
          '關於 TypeScript 的「型別抹除（Type Erasure）」特性，下列敘述何者正確？',
        options: [
          'TypeScript 的型別資訊在瀏覽器執行時仍會佔用記憶體空間',
          '編譯成 JavaScript 後，所有型別宣告都會被移除，執行期零額外開銷',
          '型別抹除代表 TypeScript 無法在編譯期檢查出錯誤',
          '必須在生產環境伺服器上安裝 TypeScript 直譯器才能執行程式碼',
        ],
        answerIndex: 1,
        explanation:
          'TypeScript 只是編譯期工具，編譯產出的 .js 檔內完全不包含任何型別註解，因此在瀏覽器中執行時沒有任何額外效能損耗。',
      },
    },
  },
  {
    mapId: DEMO_MAP_ID,
    nodeId: '1.1',
    schemaVersion: 1,
    modelId: 'demo-preloaded',
    promptVersion: 'lesson.zh-TW.v2',
    mode: 'learning',
    createdAt: Date.now() - 3600000,
    content: {
      markdown: `## 🔍 為什麼需要「型別收窄（Type Narrowing）」？

在寫程式時，一個變數剛進來時可能有多種可能性。例如一個搜尋框的輸入值 \`value\`，可能是「字串 \`string\`」也可能是「數字 \`number\`」。

這就像海關人員收到一個貼著「易碎品或液體」的包裹——在打開確認它是哪一種之前，你不敢隨便把它倒過來放。

**型別收窄**就是透過簡單的條件檢查（像過 X 光機），讓 TypeScript 確定：「在這個 \`if\` 區塊裡面，它 100% 是字串！」

## 🗺️ 型別收窄的推理流程

\`\`\`diagram
變數 value: string | number（還不確定是哪一種）
       │
       ├── if (typeof value === 'string') ──> ✅ 收窄為 string（可安全呼叫 .toUpperCase()）
       │
       └── else                           ──> ✅ 自動收窄為 number（可安全呼叫 .toFixed()）
\`\`\`

## 💻 實戰範例：用 \`typeof\` 當守門員

\`\`\`typescript
function formatInput(value: string | number): string {
  // 1. 經過 typeof 守門員檢查后，TS 確定這裡面一定是 string
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }

  // 2. 排除 string 後，TS 自動推導這裡一定是 number
  return value.toFixed(2);
}
\`\`\`

## 📊 常見的 3 種收窄工具

| 收窄方式 | 適用情境 | 範例 |
| :--- | :--- | :--- |
| **\`typeof\`** | 檢查基本型別（字串、數字、布林） | \`typeof x === "string"\` |
| **\`instanceof\`** | 檢查是否為某個類別的實例 | \`err instanceof Error\` |
| **真值檢查** | 排除 \`null\` 或 \`undefined\` | \`if (user) { ... }\` |

> 💡 **新手最常踩的小陷阱**：在 JavaScript 的歷史設計中，\`typeof null\` 出來的結果竟然是 \`"object"\`！所以在檢查物件時，別忘了多加一個 \`value !== null\`。`,
      quiz: {
        question:
          '若有一個變數 x 的型別為 string | null，下列哪種判斷「無法」成功將 x 收窄為 string？',
        options: [
          'if (typeof x === "string")',
          'if (x !== null)',
          'if (typeof x === "object")',
          'if (Boolean(x))',
        ],
        answerIndex: 2,
        explanation:
          '若使用 typeof x === "object"，因為 typeof null 在 JavaScript 中恰好是 "object"，所以該分支內 x 會被收窄為 null 而非 string。',
      },
    },
  },
];

export async function loadDemoCraft(force = false): Promise<string> {
  const existing = await mapsRepo.getById(DEMO_MAP_ID);
  if (existing && !force) {
    return DEMO_MAP_ID;
  }
  await mapsRepo.save(DEMO_MAP);
  for (const prog of DEMO_PROGRESS) {
    await progressRepo.save(prog);
  }
  for (const lesson of DEMO_LESSONS) {
    await lessonsRepo.save(lesson);
  }
  return DEMO_MAP_ID;
}
