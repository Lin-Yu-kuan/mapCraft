import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LessonDrawer } from '@/features/lesson/LessonDrawer';
import { Providers } from '@/app/providers';
import { lessonsRepo } from '@/lib/db/repos/lessons';
import { settingsRepo } from '@/lib/db/repos/settings';
import { setStoredApiKey } from '@/lib/storage/settings';
import type { LearningMap, Lesson, NodeStatus } from '@/domain/types';
import { LESSON_PROMPT_VERSION } from '@/domain/prompts';

describe('LessonDrawer & Progress State Machine (FR-04, FR-05 & AC-04)', () => {
  const originalFetch = globalThis.fetch;

  const mockMap: LearningMap = {
    id: 'test-map-lesson',
    schemaVersion: 1,
    title: 'Docker 學習地圖',
    summary: '從映像檔到容器編排',
    topic: 'Docker',
    root: {
      id: '0',
      label: 'Docker',
      summary: 'Docker 學習地圖',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Dockerfile 實作',
          summary: '撰寫標準化映像檔',
          difficulty: 'intermediate',
        },
        {
          id: '2',
          label: 'Docker Compose',
          summary: '多容器協同運作',
          difficulty: 'advanced',
        },
      ],
    },
    options: {
      level: 'beginner',
      maxDepth: 3,
      maxBreadth: 5,
      maxNodes: 30,
      temperature: 0.4,
      language: 'zh-TW',
    },
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sampleGuidedLessonContent = {
    markdown: `## 🍎 生活比喻：把環境變成食譜\n\nDockerfile 就像是一份「自動化主廚食譜」，把安裝環境的每一步寫成標準指令。\n\n| 指令 | 用途 |\n| --- | --- |\n| **FROM** | 指定基底映像檔 |\n\n\`\`\`diagram\n[Dockerfile] ──docker build──> [Docker Image]\n\`\`\``,
    quiz: {
      question: '為什麼在 Dockerfile 中通常建議指定明確的映像檔版本標籤（例如 node:20-alpine）？',
      options: [
        '因為沒有標籤無法建構',
        '避免每次建構拉到不可預期的版本，確保環境一致與可重現性',
        '為了節省磁碟空間',
        '這是 Docker 官方強制語法',
      ],
      answerIndex: 1,
      explanation: '使用具體版本能確保團隊成員與 CI/CD 環境在任何時間建構時具有完全相同的基礎執行環境。',
    },
  };

  const sampleLegacyLessonContent = {
    concept: 'Dockerfile 是一個包含多行指令的純文字文件，Docker 守護行程透過逐行解析並建立每一層唯讀 Layer。',
    why: '解決了「在我電腦上能跑」的環境不一致問題，提供可重現、版本受控的容器映像檔。',
    example: {
      scenario: '建構 Node.js 微服務映像檔',
      code: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]',
      language: 'dockerfile',
      explain: '使用 alpine 輕量映像檔，設定工作目錄並宣告啟動指令。',
    },
    pitfalls: ['避免使用 latest 標籤導致建構結果不可重現', '忘記加上 .dockerignore 導致無關檔案打包進去'],
    keyPoints: ['每條 RUN 指令都會產生新的 Image Layer', '善用 Layer 快取機制優化建構速度'],
    quiz: {
      question: '為什麼在 Dockerfile 中通常建議指定明確的映像檔版本標籤（例如 node:20-alpine）？',
      options: [
        '因為沒有標籤無法建構',
        '避免每次建構拉到不可預期的版本，確保環境一致與可重現性',
        '為了節省磁碟空間',
        '這是 Docker 官方強制語法',
      ],
      answerIndex: 1,
      explanation: '使用具體版本能確保團隊成員與 CI/CD 環境在任何時間建構時具有完全相同的基礎執行環境。',
    },
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    await lessonsRepo.clearAll();
    await settingsRepo.saveSettings({
      lastProviderId: 'openai',
      lastMapModelId: 'gpt-4o-mini',
      lastLessonModelId: 'gpt-4o',
    });
    setStoredApiKey('openai', 'sk-test-mock-key-12345678', 'local');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function renderDrawer(
    nodeId = '1',
    status: NodeStatus = 'todo',
    onUpdate = vi.fn(),
    onClose = vi.fn()
  ) {
    return render(
      <MemoryRouter>
        <Providers>
          <LessonDrawer
            map={mockMap}
            nodeId={nodeId}
            status={status}
            onClose={onClose}
            onUpdateStatus={onUpdate}
          />
        </Providers>
      </MemoryRouter>
    );
  }

  it('首次點選節點時顯示生成按鈕，點擊後呼叫 LLM API 並成功渲染引導式自由教學（含表格、圖解）與隨堂測驗', async () => {
    let fetchCalled = false;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(sampleGuidedLessonContent) } }],
        }),
      };
    });

    await act(async () => {
      renderDrawer('1');
    });

    // 驗證標題與所在路徑（只帶路徑上下文）
    expect(screen.getByText('Dockerfile 實作')).toBeInTheDocument();
    expect(screen.getByText('Docker > Dockerfile 實作')).toBeInTheDocument();

    // 驗證出現手動生成引導與按鈕
    await waitFor(() => {
      expect(screen.getByText('✨ 生成學習筆記')).toBeInTheDocument();
    });

    // 點擊手動生成按鈕
    const generateBtn = screen.getByText('✨ 生成學習筆記');
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    // 驗證引導式教學內容（小標題、表格、圖解）與隨堂測驗
    await waitFor(() => {
      expect(screen.getByText(/生活比喻：把環境變成食譜/)).toBeInTheDocument();
      expect(screen.getByText(/自動化主廚食譜/)).toBeInTheDocument();
      expect(screen.getByText('指定基底映像檔')).toBeInTheDocument();
      expect(screen.getByText('結構與流程圖解')).toBeInTheDocument();
      expect(screen.getByText('隨堂測驗')).toBeInTheDocument();
    });

    expect(fetchCalled).toBe(true);

    // 驗證已存入 Dexie 快取
    const inDb = await lessonsRepo.get(mockMap.id, '1');
    expect(inDb).toBeDefined();
    expect(inDb?.promptVersion).toBe(LESSON_PROMPT_VERSION);
  });

  it('快取命中（AC-04）與舊版 v1 向下相容：第二度點同節點時直出，不再發送網路請求', async () => {
    // 預先寫入 v1 快取驗證向下相容
    const cachedLesson: Lesson = {
      mapId: mockMap.id,
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: 'lesson.zh-TW.v1',
      content: sampleLegacyLessonContent,
      createdAt: Date.now() - 5000,
    };
    await lessonsRepo.save(cachedLesson);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await act(async () => {
      renderDrawer('1');
    });

    // 內容立即直出
    await waitFor(() => {
      expect(screen.getByText(/Dockerfile 是一個包含多行指令/)).toBeInTheDocument();
    });

    // 斷言完全未發送任何 fetch 網路請求（0 成本命中快取）
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('隨堂測驗互動：點選選項即時回饋正解狀態與詳細解析', async () => {
    const cachedLesson: Lesson = {
      mapId: mockMap.id,
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: LESSON_PROMPT_VERSION,
      content: sampleGuidedLessonContent,
      createdAt: Date.now(),
    };
    await lessonsRepo.save(cachedLesson);

    await act(async () => {
      renderDrawer('1');
    });

    await waitFor(() => {
      expect(screen.getByText(/為什麼在 Dockerfile 中通常建議指定明確/)).toBeInTheDocument();
    });

    // 點選正確選項（index 1）
    const correctOptionBtn = screen.getByText(/避免每次建構拉到不可預期的版本/);
    await act(async () => {
      fireEvent.click(correctOptionBtn);
    });

    // 顯示答對回饋與解析文字
    expect(screen.getByText(/答對了/)).toBeInTheDocument();
    expect(screen.getByText(/使用具體版本能確保團隊成員/)).toBeInTheDocument();
  });

  it('狀態機切換（FR-05）：點擊「標記為已完成」觸發狀態更新', async () => {
    const cachedLesson: Lesson = {
      mapId: mockMap.id,
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: LESSON_PROMPT_VERSION,
      content: sampleGuidedLessonContent,
      createdAt: Date.now(),
    };
    await lessonsRepo.save(cachedLesson);

    const onUpdateMock = vi.fn();

    await act(async () => {
      renderDrawer('1', 'todo', onUpdateMock);
    });

    await waitFor(() => {
      expect(screen.getByText('標記為已完成')).toBeInTheDocument();
    });

    const doneBtn = screen.getByText('標記為已完成');
    await act(async () => {
      fireEvent.click(doneBtn);
    });

    expect(onUpdateMock).toHaveBeenCalledWith('1', 'done');
  });
});
