import { describe, it, expect } from 'vitest';
import type { LearningMap, NodeProgress } from '@/domain/types';
import { generateMapOpml } from '@/domain/export/opml';

describe('domain/export/opml (SPEC §2 FR-07 OPML 心智圖匯出)', () => {
  const sampleMap: LearningMap = {
    id: 'map-opml-test',
    schemaVersion: 1,
    title: 'Vue & React 概念對比 <2026>',
    summary: '深入探討兩大前端框架的響應式與組件模型 & 差異',
    topic: 'Vue & React',
    root: {
      id: '0',
      label: '前端框架對比',
      summary: '核心概念',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: '響應式原理 (Reactivity & Hooks)',
          summary: 'Proxy 與 useState 內部運作',
          difficulty: 'intermediate',
          children: [
            {
              id: '1.1',
              label: 'Vue 3 Proxy 系統',
              summary: '依賴收集與觸發',
              difficulty: 'intermediate',
            },
          ],
        },
        {
          id: '2',
          label: '虛擬 DOM 與編譯優化',
          summary: 'Diff 演算法差異',
          difficulty: 'advanced',
        },
      ],
    },
    options: {
      level: 'some',
      maxDepth: 3,
      maxBreadth: 5,
      maxNodes: 30,
      temperature: 0.4,
      language: 'zh-TW',
    },
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const sampleProgress: NodeProgress[] = [
    {
      mapId: 'map-opml-test',
      nodeId: '1',
      status: 'done',
      attempts: 1,
      correct: 1,
      updatedAt: 1700000020000,
    },
    {
      mapId: 'map-opml-test',
      nodeId: '1.1',
      status: 'learning',
      attempts: 0,
      correct: 0,
      updatedAt: 1700000020000,
    },
  ];

  it('產出符合 OPML 2.0 結構的 XML 字串', () => {
    const xml = generateMapOpml(sampleMap, sampleProgress);

    // 驗證 XML 宣告與根節點
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain('<generator>MapCraft');

    // 驗證標題與 XML 跳脫（& -> &amp;, < -> &lt;, > -> &gt;）
    expect(xml).toContain('<title>Vue &amp; React 概念對比 &lt;2026&gt;</title>');

    // 驗證包含大綱結構
    expect(xml).toContain('<outline text="Vue &amp; React 概念對比 &lt;2026&gt;"');
    expect(xml).toContain('1 響應式原理 (Reactivity &amp; Hooks)');
    expect(xml).toContain('1.1 Vue 3 Proxy 系統');
    expect(xml).toContain('2 虛擬 DOM 與編譯優化');

    // 驗證狀態呈現
    expect(xml).toContain('狀態: 已完成');
    expect(xml).toContain('狀態: 學習中');
    expect(xml).toContain('狀態: 未開始');
  });

  it('無進度資料時仍能正確產出所有節點且標記為未開始', () => {
    const xml = generateMapOpml(sampleMap, []);
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain('狀態: 未開始');
    expect(xml).not.toContain('狀態: 已完成');
  });
});
