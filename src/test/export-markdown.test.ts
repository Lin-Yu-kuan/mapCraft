import { describe, it, expect } from 'vitest';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';
import { generateMapMarkdown } from '@/domain/export/markdown';

describe('domain/export/markdown (SPEC 附錄 B & FR-07)', () => {
  const sampleMap: LearningMap = {
    id: 'map-export-test',
    schemaVersion: 1,
    title: 'Docker 實戰學習手冊',
    summary: '從基礎觀念到容器編排的完整學習地圖',
    topic: 'Docker',
    root: {
      id: '0',
      label: 'Docker',
      summary: '核心架構',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Docker 基礎觀念',
          summary: '理解 Container 與 Image 差異',
          difficulty: 'beginner',
          children: [
            {
              id: '1.1',
              label: 'Dockerfile 實作',
              summary: '撰寫標準化映像檔建構檔',
              difficulty: 'intermediate',
            },
          ],
        },
        {
          id: '2',
          label: 'Docker Compose',
          summary: '多容器微服務宣告與部署',
          difficulty: 'intermediate',
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
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const sampleProgress: NodeProgress[] = [
    {
      mapId: 'map-export-test',
      nodeId: '1',
      status: 'done',
      attempts: 1,
      correct: 1,
      updatedAt: 1700000000000,
    },
    {
      mapId: 'map-export-test',
      nodeId: '1.1',
      status: 'learning',
      attempts: 0,
      correct: 0,
      updatedAt: 1700000000000,
    },
    {
      mapId: 'map-export-test',
      nodeId: '2',
      status: 'todo',
      attempts: 0,
      correct: 0,
      updatedAt: 1700000000000,
    },
  ];

  const sampleLessons: Lesson[] = [
    {
      mapId: 'map-export-test',
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: 'lesson.zh-TW.v1',
      content: {
        concept: 'Docker 透過 Linux cgroups 與 namespaces 實現程序隔離。',
        why: '解決環境相依性與維護痛點。',
        pitfalls: ['避免把整個作業系統完整打包進容器'],
        keyPoints: ['Container 是執行中的隔離程序', 'Image 是唯讀的靜態範本'],
      },
      createdAt: 1700000000000,
    },
  ];

  it('產出符合 SPEC 附錄 B 格式的結構化 Markdown 學習手冊', () => {
    const md = generateMapMarkdown(sampleMap, sampleProgress, sampleLessons);

    // 標題與簡介
    expect(md).toContain('# Docker 實戰學習手冊');
    expect(md).toContain('> 從基礎觀念到容器編排的完整學習地圖');
    expect(md).toContain('由 MapCraft 產生（AI 生成內容，請自行查證）');

    // 進度標記
    expect(md).toContain('完成度 1/3（33%）');

    // 章節與核取方塊（已完成為 - [x]，未完成為 - [ ]）
    expect(md).toContain('- [x] **1. Docker 基礎觀念**');
    expect(md).toContain('- [ ] **1.1 Dockerfile 實作**');
    expect(md).toContain('- [ ] **2. Docker Compose**');

    // 教材內容融入（重點與誤解）
    expect(md).toContain('重點：Container 是執行中的隔離程序 ｜ Image 是唯讀的靜態範本');
    expect(md).toContain('常見誤解：避免把整個作業系統完整打包進容器');
  });
});
