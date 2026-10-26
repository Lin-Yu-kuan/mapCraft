import { describe, it, expect } from 'vitest';
import type { MapNode } from '@/domain/types';
import { calculateTreeLayout } from '@/domain/layout';

describe('domain/layout (SPEC §3.4 & §8.1)', () => {
  const sampleRoot: MapNode = {
    id: '0',
    label: 'Docker 學習地圖',
    summary: '從映像檔到容器編排',
    difficulty: 'beginner',
    children: [
      {
        id: '1',
        label: 'Docker 基礎',
        summary: 'Image 與 Container',
        difficulty: 'beginner',
        children: [
          {
            id: '1.1',
            label: 'Dockerfile 實作',
            summary: '建構標準映像檔',
            difficulty: 'intermediate',
          },
          {
            id: '1.2',
            label: 'Docker 網路',
            summary: '容器互聯與 Port 映射',
            difficulty: 'intermediate',
          },
        ],
      },
      {
        id: '2',
        label: 'Docker Compose',
        summary: '多容器協同運作',
        difficulty: 'intermediate',
      },
      {
        id: '3',
        label: 'Kubernetes 入門',
        summary: '進階容器叢集編排',
        difficulty: 'advanced',
      },
    ],
  };

  it('正確計算由左至右的節點座標與連線', () => {
    const { nodes, edges } = calculateTreeLayout(sampleRoot);

    // 總共 6 個節點（0, 1, 1.1, 1.2, 2, 3）
    expect(nodes).toHaveLength(6);
    expect(edges).toHaveLength(5); // 連線數 = 節點數 - 1

    // 根節點 x 座標應為最左側（0）
    const rootNode = nodes.find((n) => n.id === '0');
    expect(rootNode).toBeDefined();
    expect(rootNode?.position.x).toBe(0);

    // 子節點的 x 座標應大於父節點（由左至右展開）
    const node1 = nodes.find((n) => n.id === '1');
    const node11 = nodes.find((n) => n.id === '1.1');
    expect(node1).toBeDefined();
    expect(node11).toBeDefined();
    expect(node1!.position.x).toBeGreaterThan(rootNode!.position.x);
    expect(node11!.position.x).toBeGreaterThan(node1!.position.x);
  });

  it('節點座標之間互不重疊（無邊界碰撞）', () => {
    const { nodes } = calculateTreeLayout(sampleRoot);

    const NODE_WIDTH = 260;
    const NODE_HEIGHT = 90;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;

        // 檢查 A 與 B 的矩形是否有重疊
        const isOverlap =
          a.position.x < b.position.x + NODE_WIDTH &&
          a.position.x + NODE_WIDTH > b.position.x &&
          a.position.y < b.position.y + NODE_HEIGHT &&
          a.position.y + NODE_HEIGHT > b.position.y;

        expect(isOverlap).toBe(false);
      }
    }
  });

  it('支援收合節點：被收合節點的子樹不輸出節點與連線', () => {
    const collapsed = new Set(['1']); // 收合節點 1
    const { nodes, edges } = calculateTreeLayout(sampleRoot, collapsed);

    // 節點 1.1 和 1.2 應被隱藏
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain('0');
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
    expect(ids).not.toContain('1.1');
    expect(ids).not.toContain('1.2');

    // 連線也不包含連到 1.1 / 1.2 的線
    const edgeTargets = edges.map((e) => e.target);
    expect(edgeTargets).not.toContain('1.1');
    expect(edgeTargets).not.toContain('1.2');

    // 節點 1 的 isCollapsed 狀態應為 true
    const node1 = nodes.find((n) => n.id === '1');
    expect(node1?.data.isCollapsed).toBe(true);
    expect(node1?.data.hasChildren).toBe(true);
    expect(node1?.data.childrenCount).toBe(2);
  });
});
