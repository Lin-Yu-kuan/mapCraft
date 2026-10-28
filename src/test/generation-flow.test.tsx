import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '@/features/generation/HomePage';
import { Providers } from '@/app/providers';
import { settingsRepo } from '@/lib/db/repos/settings';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import { setStoredApiKey } from '@/lib/storage/settings';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('HomePage & Generation Flow (FR-02 & AC-02)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    mockNavigate.mockReset();

    // 預先設定好 OpenAI provider 與 fake key
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

  function renderWithProviders() {
    return render(
      <MemoryRouter>
        <Providers>
          <HomePage />
        </Providers>
      </MemoryRouter>
    );
  }

  it('主題為空時送出鍵 disabled，點選範例主題可自動填入', async () => {
    await act(async () => {
      renderWithProviders();
    });

    const submitBtn = screen.getByRole('button', { name: /開始規劃地圖/ });
    expect(submitBtn).toBeDisabled();

    // 點選範例主題
    const sampleBtn = screen.getByText('Spring Boot 內部系統開發');
    await act(async () => {
      fireEvent.click(sampleBtn);
    });

    const input = screen.getByPlaceholderText(/例如：Spring Boot/) as HTMLInputElement;
    expect(input.value).toBe('Spring Boot 內部系統開發');
    expect(submitBtn).not.toBeDisabled();
  });

  it('支援輸入目前熟悉程度的補充說明', async () => {
    await act(async () => {
      renderWithProviders();
    });

    const levelDescInput = screen.getByPlaceholderText(/可補充說明背景經驗/);
    expect(levelDescInput).toBeInTheDocument();

    fireEvent.change(levelDescInput, {
      target: { value: '寫過 2 年 Python，想轉學習 Go' },
    });

    expect((levelDescInput as HTMLInputElement).value).toBe('寫過 2 年 Python，想轉學習 Go');
  });

  it('可展開與收合進階設定參數面板', async () => {
    await act(async () => {
      renderWithProviders();
    });

    // 初始未展開
    expect(screen.queryByText(/地圖深度上限/)).not.toBeInTheDocument();

    const toggleBtn = screen.getByText(/生成進階設定/);
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // 展開後顯示各參數
    expect(screen.getByText(/地圖深度上限/)).toBeInTheDocument();
    expect(screen.getByText(/每層節點廣度上限/)).toBeInTheDocument();
    expect(screen.getByText(/總學習節點數上限/)).toBeInTheDocument();
    expect(screen.getByText(/創意度與發散性/)).toBeInTheDocument();
  });

  it('成功生成地圖時存入 Dexie 並導向地圖頁面', async () => {
    // 依據 MapGenerationResponseSchema：nodes 長度 >= 3，summary >= 10 字
    const validApiResponse = {
      title: 'Docker 學習地圖',
      summary: '全面且系統化掌握從映像檔建置到容器編排的實戰指南',
      nodes: [
        {
          id: '1',
          label: 'Docker 核心觀念',
          summary: '理解 Container 與 Image 核心架構差異',
          difficulty: 'beginner',
          children: [
            {
              id: '1.1',
              label: 'Dockerfile 實作',
              summary: '撰寫標準化高效率映像檔建構檔',
              difficulty: 'intermediate',
            },
          ],
        },
        {
          id: '2',
          label: 'Docker Compose',
          summary: '多容器微服務協同宣告與運作管理',
          difficulty: 'intermediate',
        },
        {
          id: '3',
          label: 'Docker 網路與儲存',
          summary: '掌握 Volume 資料持久化與 Bridge 網路',
          difficulty: 'advanced',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validApiResponse),
            },
          },
        ],
      }),
    });

    await act(async () => {
      renderWithProviders();
    });

    const input = screen.getByPlaceholderText(/例如：Spring Boot/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Docker' } });
    });

    const submitBtn = screen.getByRole('button', { name: /開始規劃地圖/ });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 等待非同步完成導向
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    const targetUrl = mockNavigate.mock.calls[0]?.[0] as string;
    expect(targetUrl).toMatch(/^\/map\/.+/);

    // 驗證 Dexie 中已儲存此 map 與學習節點 progress
    const allMaps = await mapsRepo.getAll();
    expect(allMaps.length).toBeGreaterThan(0);
    const savedMap = allMaps[0];
    expect(savedMap).toBeDefined();
    if (!savedMap) return;
    expect(savedMap.title).toBe('Docker 學習地圖');

    const progressList = await progressRepo.getByMapId(savedMap.id);
    expect(progressList.length).toBe(4); // 1, 1.1, 2, 3
    expect(progressList.every((p) => p.status === 'todo')).toBe(true);
  });

  it('第一次回傳非合法 JSON 時自動觸發修復重試，若修復成功仍可正常導向', async () => {
    const brokenContent = 'Here is the plan: {"title": "修復測試", "nodes": [BROKEN...';
    const repairedContent = JSON.stringify({
      title: '已修復的地圖',
      summary: '這是經過自動修復後的完整且合法的學習地圖摘要',
      nodes: [
        {
          id: '1',
          label: '修復後第一模組',
          summary: '修復後模組一詳細描述內容',
          difficulty: 'beginner',
        },
        {
          id: '2',
          label: '修復後第二模組',
          summary: '修復後模組二詳細描述內容',
          difficulty: 'intermediate',
        },
        {
          id: '3',
          label: '修復後第三模組',
          summary: '修復後模組三詳細描述內容',
          difficulty: 'advanced',
        },
      ],
    });

    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: brokenContent } }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: repairedContent } }],
        }),
      };
    });

    await act(async () => {
      renderWithProviders();
    });

    const input = screen.getByPlaceholderText(/例如：Spring Boot/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Auto Repair' } });
    });

    const submitBtn = screen.getByRole('button', { name: /開始規劃地圖/ });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 應呼叫 2 次 fetch（第 1 次初次請求，第 2 次自動修復請求）
    await waitFor(() => {
      expect(fetchCount).toBe(2);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it('若未設定金鑰，跳出提示面板引導至設定頁面', async () => {
    // 清除金鑰
    setStoredApiKey('openai', '', 'local');

    await act(async () => {
      renderWithProviders();
    });

    const input = screen.getByPlaceholderText(/例如：Spring Boot/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'No Key' } });
    });

    const submitBtn = screen.getByRole('button', { name: /開始規劃地圖/ });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText('尚未設定 API 金鑰')).toBeInTheDocument();
    expect(screen.getByText('前往設定金鑰')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
