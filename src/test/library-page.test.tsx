import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LibraryPage } from '@/features/library/LibraryPage';
import { Providers } from '@/app/providers';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import type { LearningMap } from '@/domain/types';

describe('LibraryPage (SPEC §0 Your crafts & T2.7)', () => {
  const sampleMap: LearningMap = {
    id: 'test-map-123',
    schemaVersion: 1,
    title: 'Docker 學習地圖',
    summary: '從映像檔到容器編排的實戰指南',
    topic: 'Docker',
    root: {
      id: '0',
      label: 'Docker',
      summary: 'Docker 學習地圖',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Docker 基礎觀念',
          summary: '容器與映像檔差異',
          difficulty: 'beginner',
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
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    // 清理 DB
    const all = await mapsRepo.getAll();
    for (const m of all) {
      await mapsRepo.delete(m.id);
    }
  });

  function renderLibrary() {
    return render(
      <MemoryRouter>
        <Providers>
          <LibraryPage />
        </Providers>
      </MemoryRouter>
    );
  }

  it('無地圖時顯示空狀態與引導按鈕', async () => {
    await act(async () => {
      renderLibrary();
    });

    expect(screen.getByText('Your crafts（地圖庫）')).toBeInTheDocument();
    expect(screen.getByText('尚無任何學習地圖')).toBeInTheDocument();
    expect(screen.getByText('Craft a map')).toBeInTheDocument();
  });

  it('載入地圖清單並支援搜尋與標題修改', async () => {
    await mapsRepo.save(sampleMap);
    await progressRepo.save({
      mapId: sampleMap.id,
      nodeId: '1',
      status: 'done',
      attempts: 1,
      correct: 1,
      updatedAt: Date.now(),
    });

    await act(async () => {
      renderLibrary();
    });

    // 檢查卡片內容
    await waitFor(() => {
      expect(screen.getByText('Docker 學習地圖')).toBeInTheDocument();
      expect(screen.getByText(/1 個知識點/)).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    // 搜尋過濾
    const searchInput = screen.getByPlaceholderText(/搜尋地圖名稱/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '不存在的主題' } });
    });
    expect(screen.queryByText('Docker 學習地圖')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Docker' } });
    });
    expect(screen.getByText('Docker 學習地圖')).toBeInTheDocument();

    // 改名
    const editBtn = screen.getByLabelText('編輯地圖名稱');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    const editInput = screen.getByDisplayValue('Docker 學習地圖');
    await act(async () => {
      fireEvent.change(editInput, { target: { value: 'Docker 實戰全攻略' } });
    });

    const confirmBtn = screen.getByLabelText('確認修改名稱');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Docker 實戰全攻略')).toBeInTheDocument();
    });

    // 驗證 Dexie 已同步更新
    const inDb = await mapsRepo.getById(sampleMap.id);
    expect(inDb?.title).toBe('Docker 實戰全攻略');
  });

  it('支援二階刪除地圖，並連帶清理相關資料', async () => {
    await mapsRepo.save(sampleMap);

    await act(async () => {
      renderLibrary();
    });

    await waitFor(() => {
      expect(screen.getByText('Docker 學習地圖')).toBeInTheDocument();
    });

    // 點擊刪除按鈕
    const deleteBtn = screen.getByLabelText('刪除地圖');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    // 出現確認文字
    expect(screen.getByText(/確定要刪除這張地圖嗎/)).toBeInTheDocument();

    // 確認刪除
    const confirmDeleteBtn = screen.getByRole('button', { name: '刪除' });
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText('Docker 學習地圖')).not.toBeInTheDocument();
      expect(screen.getByText('尚無任何學習地圖')).toBeInTheDocument();
    });

    // 驗證 Dexie 中已無此地圖
    const inDb = await mapsRepo.getById(sampleMap.id);
    expect(inDb).toBeUndefined();
  });
});
