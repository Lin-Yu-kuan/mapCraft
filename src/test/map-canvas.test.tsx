import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MapPage } from '@/features/map/MapPage';
import { Providers } from '@/app/providers';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import type { LearningMap } from '@/domain/types';

// Mock ResizeObserver for React Flow in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('MapPage & MapCanvas (FR-03 & AC-03)', () => {
  const sampleMap: LearningMap = {
    id: 'canvas-test-map',
    schemaVersion: 1,
    title: 'React Flow 實戰地圖',
    summary: '畫布縮放平移與節點自訂渲染完整教學',
    topic: 'React Flow',
    root: {
      id: '0',
      label: 'React Flow',
      summary: '畫布核心概念',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: '節點自訂 NodeCard',
          summary: 'Handle 與自訂狀態',
          difficulty: 'intermediate',
          children: [
            {
              id: '1.1',
              label: '子節點展開收合',
              summary: '切換子樹隱藏顯示',
              difficulty: 'advanced',
            },
          ],
        },
        {
          id: '2',
          label: 'MiniMap 整合',
          summary: '縮圖導航與顏色設定',
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    const all = await mapsRepo.getAll();
    for (const m of all) {
      await mapsRepo.delete(m.id);
    }
  });

  function renderMapPage(mapId = 'canvas-test-map') {
    return render(
      <MemoryRouter initialEntries={[`/map/${mapId}`]}>
        <Providers>
          <Routes>
            <Route path="/map/:id" element={<MapPage />} />
          </Routes>
        </Providers>
      </MemoryRouter>
    );
  }

  it('查無地圖時渲染 empty 態，提示找不到頁面並提供返回連結', async () => {
    await act(async () => {
      renderMapPage('non-existent-id');
    });

    await waitFor(() => {
      expect(screen.getByText('找不到頁面')).toBeInTheDocument();
      expect(screen.getByText('地圖庫')).toBeInTheDocument();
      expect(screen.getByText('建立新地圖')).toBeInTheDocument();
    });
  });

  it('成功載入地圖時渲染畫布、節點卡片、難度色標與底部進度指示', async () => {
    await mapsRepo.save(sampleMap);
    await progressRepo.save({
      mapId: sampleMap.id,
      nodeId: '1',
      status: 'learning',
      attempts: 0,
      correct: 0,
      updatedAt: Date.now(),
    });
    await progressRepo.save({
      mapId: sampleMap.id,
      nodeId: '2',
      status: 'done',
      attempts: 1,
      correct: 1,
      updatedAt: Date.now(),
    });

    await act(async () => {
      renderMapPage(sampleMap.id);
    });

    // 檢查節點卡片文字
    await waitFor(() => {
      expect(screen.getByText('節點自訂 NodeCard')).toBeInTheDocument();
      expect(screen.getByText('MiniMap 整合')).toBeInTheDocument();
    });

    // 難度標籤
    expect(screen.getAllByText('入門').length).toBeGreaterThan(0);
    expect(screen.getByText('進階')).toBeInTheDocument();

    // 底部進度文字（總共 3 個學習節點：1, 1.1, 2，其中 2 是 done，進度 1/3 (33%)）
    expect(screen.getByText(/已完成 1\/3（33%）/)).toBeInTheDocument();
  });
});
