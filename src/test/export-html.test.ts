import { describe, it, expect } from 'vitest';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';
import { generateMapHtml } from '@/domain/export/html';

describe('domain/export/html (Interactive Mindmap & Lesson HTML Export)', () => {
  const sampleMap: LearningMap = {
    id: 'map-html-test',
    schemaVersion: 1,
    title: 'Docker 學習手冊',
    summary: '從映像檔到容器編排',
    topic: 'Docker',
    root: {
      id: '0',
      label: 'Docker',
      summary: '核心架構',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Dockerfile 實作',
          summary: '撰寫標準映像檔',
          difficulty: 'intermediate',
        },
        {
          id: '2',
          label: '創意發想主題',
          summary: '容器技術的大膽應用',
          difficulty: 'advanced',
          mode: 'brainstorm',
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
      mapId: 'map-html-test',
      nodeId: '1',
      status: 'done',
      attempts: 1,
      correct: 1,
      updatedAt: 1700000000000,
    },
  ];

  const sampleLessons: Lesson[] = [
    {
      mapId: 'map-html-test',
      nodeId: '1',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: 'lesson.zh-TW.v1',
      content: {
        concept: 'Dockerfile 是自動化建構映像檔的指令稿。',
        why: '確保跨機器環境一致。',
        example: {
          scenario: '微服務打包',
          code: 'FROM node:20',
          language: 'dockerfile',
          explain: '指定基底映像檔',
        },
        pitfalls: ['避免使用 latest 標籤'],
        keyPoints: ['每行指令都會產生 Layer'],
      },
      createdAt: 1700000000000,
    },
    {
      mapId: 'map-html-test',
      nodeId: '2',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: 'brainstorm.zh-TW.v1',
      mode: 'brainstorm',
      content: {
        concept: '將容器應用於邊緣運算',
        why: '分散式處理',
        pitfalls: [],
        keyPoints: [],
      },
      brainstormContent: {
        coreIdea: '建立自癒型輕量邊緣節點叢集',
        useCases: ['智慧農業感測節點', '離線無人機即時數據分析'],
        challenges: ['網路斷線時的狀態同步', '極限記憶體資源控制'],
        nextSteps: ['先用 k3s 在樹莓派上驗證原型'],
      },
      createdAt: 1700000000000,
    },
    {
      mapId: 'map-html-test',
      nodeId: '0',
      schemaVersion: 1,
      modelId: 'gpt-4o',
      promptVersion: 'lesson.zh-TW.v2',
      content: {
        concept: 'Docker 核心架構概述',
        why: '現代微服務基石',
        pitfalls: [],
        keyPoints: [],
        markdown: `## 核心概念

Docker 採用 **Client-Server** 架構。

### 重點清單
- 容器映像檔（Image）是唯讀模板
- 容器（Container）是映像檔的執行實體
- Docker 守護進程（dockerd）負責管理資源

### 常用指令比較
| 指令 | 說明 | 範例 |
| :--- | :--- | :--- |
| run | 建立並啟動 | docker run -d nginx |
| ps | 列出容器 | docker ps -a |

\`\`\`bash
# 啟動容器
docker run -d -p 8080:80 --name web nginx
\`\`\`

\`\`\`diagram
[Client] ---> [Docker Daemon] ---> [Containers]
\`\`\`
`,
        quiz: {
          question: '下列何者是 Docker 的唯讀模板？',
          options: ['Container', 'Image', 'Volume', 'Network'],
          answerIndex: 1,
          explanation: 'Image 是容器的靜態唯讀模板。',
        },
      },
      createdAt: 1700000000000,
    },
  ];

  it('產出包含完整宣告與獨立樣式腳本的單一 HTML 檔案', () => {
    const html = generateMapHtml(sampleMap, sampleProgress, sampleLessons);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="zh-TW">');
    expect(html).toContain('Docker 學習手冊');
    expect(html).toContain('Dockerfile 實作');
    expect(html).toContain('創意發想主題');
  });

  it('包含節點學習內容與腦力激盪 4 大分區', () => {
    const html = generateMapHtml(sampleMap, sampleProgress, sampleLessons);
    expect(html).toContain('Dockerfile 是自動化建構映像檔的指令稿');
    expect(html).toContain('建立自癒型輕量邊緣節點叢集');
    expect(html).toContain('智慧農業感測節點');
    expect(html).toContain('離線無人機即時數據分析');
    expect(html).toContain('先用 k3s 在樹莓派上驗證原型');
  });

  it('完整保留 markdownContent 的各項語法、清單文字、表格與隨堂測驗，絕不發生文字遺失', () => {
    const html = generateMapHtml(sampleMap, sampleProgress, sampleLessons);
    // 內文與核心標記完整包含在靜態手冊資料中
    expect(html).toContain('Client-Server');
    expect(html).toContain('**Client-Server**');
    // 清單項目文字完整無缺，未被正則錯誤清空
    expect(html).toContain('容器映像檔（Image）是唯讀模板');
    expect(html).toContain('容器（Container）是映像檔的執行實體');
    expect(html).toContain('Docker 守護進程（dockerd）負責管理資源');
    // 表格文字與語法完整存在
    expect(html).toContain('常用指令比較');
    expect(html).toContain('docker run -d nginx');
    expect(html).toContain('docker ps -a');
    // 程式碼區塊完整存在
    expect(html).toContain('docker run -d -p 8080:80 --name web nginx');
    // 流程與結構圖解專屬樣式（包含 diagram-window 與複製圖解按鈕，無黑底衝突）
    expect(html).toContain('.diagram-window');
    expect(html).toContain('.diagram-btn-copy');
    expect(html).toContain('[Client] ---> [Docker Daemon]');
    // 隨堂測驗題目、選項與詳解完整存在
    expect(html).toContain('下列何者是 Docker 的唯讀模板？');
    expect(html).toContain('Container');
    expect(html).toContain('Image');
    expect(html).toContain('Image 是容器的靜態唯讀模板。');
  });
});
