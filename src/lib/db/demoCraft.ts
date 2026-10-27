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
  providerId: 'webgpu',
  modelId: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
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
    promptVersion: 'lesson.zh-TW.v1',
    mode: 'learning',
    createdAt: Date.now() - 3600000,
    content: {
      concept:
        'TypeScript 是由微軟開發的開放原始碼程式語言，它是 JavaScript 的超集（Superset），在現有的 JS 語法上擴充了「靜態型別系統」與「型別推斷能力」。所有合法的 JavaScript 程式碼都是合法的 TypeScript 程式碼，但 TypeScript 能在編譯期（Compile-time）抓出 80% 以上常見的執行階段錯誤（如 undefined is not a function）。',
      why: 'JavaScript 本身是弱型別動態語言，變數可以在執行時期隨意改變型別。這在小型個人專案雖然靈活，但在大型跨團隊專案中，非常容易因為打錯字、物件結構變更、缺少防呆驗證而引發線上系統當機。TypeScript 讓編輯器（如 VS Code）獲得無比強大的自動補全、安全重構與語意導航能力，大幅降低溝通成本。',
      example: {
        scenario: '定義使用者資料介面並限制函數參數型別',
        code: `// 定義使用者的資料規格契約（Interface）\ninterface User {\n  id: string;\n  name: string;\n  email?: string;\n  role: 'admin' | 'member';\n}\n\nfunction greetUser(user: User): string {\n  return \`歡迎回來，\${user.name} (\${user.role})\`;\n}\n\n// 靜態編譯期即可防範屬性遺漏或拼寫錯誤\ngreetUser({ id: '1', name: 'Alex', role: 'admin' });`,
        language: 'typescript',
        explain:
          '透過宣告 User 介面，函數參數便受到嚴格保護；一旦傳入不存在的屬性或錯誤的角色字串，編譯器立刻劃紅線提示。',
      },
      pitfalls: [
        '誤以為 TypeScript 會增加瀏覽器執行時期的效能開銷：其實 TypeScript 在打包時所有型別資訊都會被完全剝除（Type Erasure），產出純淨 JavaScript，因此執行期零效能損耗。',
        '過度使用 any：濫用 any 會直接關閉編譯器的型別檢查防護網，使 TypeScript 退化成普通的 JavaScript。應優先考慮 unknown 或自訂泛型。',
      ],
      keyPoints: [
        'TypeScript 是 JavaScript 的語法超集，只在編譯期進行靜態檢查。',
        '型別抹除（Type Erasure）特性確保編譯產物是純粹高效的 JS。',
        '型別即文件，能為大型團隊協作與 IDE 智慧感知提供堅實基礎。',
      ],
      quiz: {
        question:
          '關於 TypeScript 的「型別抹除（Type Erasure）」特性，下列敘述何者正確？',
        options: [
          'TypeScript 的型別資訊在瀏覽器執行時仍會佔用記憶體空間',
          '編譯成 JavaScript 後，所有 interface 與型別宣告都會被移除，執行期零額外開銷',
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
    promptVersion: 'lesson.zh-TW.v1',
    mode: 'learning',
    createdAt: Date.now() - 3600000,
    content: {
      concept:
        '型別收窄（Type Narrowing）是指 TypeScript 根據程式碼中的條件分支判斷（例如 if、switch、typeof、instanceof），在特定的程式碼區塊內將原本寬鬆的型別（如 string | number）自動推論並精確縮小為更具體的型別。',
      why: '當處理 API 回傳資料或不同格式的輸入參數時，我們經常使用聯合型別（Union Types）。若沒有型別收窄，TypeScript 會限制你只能存取所有聯合成員的「交集屬性」；透過收窄，可以在確認型別後放心呼叫該型別專屬的方法（例如字串的 toUpperCase 或陣列的 map）。',
      example: {
        scenario: '透過 typeof 守門員區分字串與數字',
        code: `function formatInput(value: string | number): string {\n  // 透過 typeof 進行型別收窄\n  if (typeof value === 'string') {\n    return value.trim().toUpperCase(); // 此區塊內 value 確定為 string\n  }\n  return value.toFixed(2); // 此區塊內 value 確定為 number\n}`,
        language: 'typescript',
        explain:
          '在 typeof value === "string" 的判斷分支下，TypeScript 智慧收窄型別，因此可以安全存取 .trim() 與 .toUpperCase()。',
      },
      pitfalls: [
        '誤以為 typeof null 會回傳 "null"：在 JavaScript 歷史設計中，typeof null 會回傳 "object"，進行物件收窄時必須額外加入 value !== null 檢查。',
      ],
      keyPoints: [
        'Type Narrowing 讓聯合型別在各條件分支中獲得安全且精確的型別推導。',
        '常見收窄守門員包括 typeof、instanceof、in 關鍵字以及自訂 is 型別謂詞（Type Predicate）。',
      ],
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
