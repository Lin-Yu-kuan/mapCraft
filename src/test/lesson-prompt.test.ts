import { describe, it, expect } from 'vitest';
import {
  buildLessonPrompt,
  type PredecessorSummary,
} from '@/domain/prompts/lesson.zh-TW';
import { getNodePredecessors } from '@/domain/tree';
import type { MapNode } from '@/domain/types';

describe('方案 2：前置節點摘要鏈 (Predecessor Summary Chain)', () => {
  const mockTree: MapNode = {
    id: 'root',
    label: 'Docker 實戰',
    summary: '從零學會容器化',
    difficulty: 'beginner',
    children: [
      {
        id: 'c1',
        label: '核心觀念',
        summary: '理解容器是隔離行程非虛擬機',
        difficulty: 'beginner',
        children: [
          {
            id: 'c1-1',
            label: '映像檔與容器',
            summary: 'Image 是唯讀模板，Container 是執行實例',
            difficulty: 'beginner',
          },
          {
            id: 'c1-2',
            label: 'Dockerfile 實作',
            summary: '學習編寫標準化構建指令',
            difficulty: 'intermediate',
          },
        ],
      },
    ],
  };

  it('getNodePredecessors 能精準取出父節點與前一個兄弟節點的綱要', () => {
    // 針對 c1-2 (Dockerfile 實作)
    const predecessors = getNodePredecessors(mockTree, 'c1-2');
    expect(predecessors).toHaveLength(2);

    expect(predecessors[0]).toEqual({
      role: 'parent',
      label: '核心觀念',
      summary: '理解容器是隔離行程非虛擬機',
    });

    expect(predecessors[1]).toEqual({
      role: 'prev_sibling',
      label: '映像檔與容器',
      summary: 'Image 是唯讀模板，Container 是執行實例',
    });
  });

  it('若是第一層第一個節點，不包含前置兄弟，父節點為根節點時不重複放入', () => {
    const predecessors = getNodePredecessors(mockTree, 'c1');
    expect(predecessors).toHaveLength(0);
  });

  it('buildLessonPrompt 在帶有 predecessors 時應正確組裝承先啟後脈絡', () => {
    const predecessors: PredecessorSummary[] = [
      {
        role: 'parent',
        label: '核心觀念',
        summary: '理解容器是隔離行程非虛擬機',
      },
      {
        role: 'prev_sibling',
        label: '映像檔與容器',
        summary: 'Image 是唯讀模板，Container 是執行實例',
      },
    ];

    const { user } = buildLessonPrompt({
      mapTitle: 'Docker 實戰',
      pathLabels: 'Docker > 核心觀念 > Dockerfile 實作',
      level: 'beginner',
      nodeLabel: 'Dockerfile 實作',
      nodeSummary: '學習編寫標準化構建指令',
      predecessors,
    });

    // 檢查包含前置知識脈絡提示
    expect(user).toContain('【學習者已掌握的前置知識脈絡】');
    expect(user).toContain('【上層總綱】 核心觀念：理解容器是隔離行程非虛擬機');
    expect(user).toContain('【前一單元】 映像檔與容器：Image 是唯讀模板，Container 是執行實例');
    expect(user).toContain('【教學銜接指示】');
  });

  it('buildLessonPrompt 在無 predecessors 時保持向下相容且無多餘區塊', () => {
    const { user } = buildLessonPrompt({
      mapTitle: 'Docker 實戰',
      pathLabels: 'Docker > 核心觀念',
      level: 'beginner',
      nodeLabel: '核心觀念',
      nodeSummary: '理解容器是隔離行程非虛擬機',
    });

    expect(user).not.toContain('【學習者已掌握的前置知識脈絡】');
    expect(user).not.toContain('【教學銜接指示】');
  });
});

