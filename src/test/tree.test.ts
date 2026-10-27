import { describe, it, expect } from 'vitest';
import type { MapNode, GenerationOptions, MapGenerationResponse } from '@/domain';
import {
  reassignIds,
  trimTree,
  dedupeNodes,
  flattenTree,
  walkTree,
  findNode,
  getNodePath,
  countLearningNodes,
  createMapFromResponse,
  getNodeParent,
  getNodeSiblings,
  addChildNodes,
  removeNode,
  getSubtreeNodeIds,
} from '@/domain/tree';

describe('domain/tree', () => {
  const sampleNodes: MapNode[] = [
    {
      id: 'old-1',
      label: 'Node A',
      summary: 'Summary A',
      difficulty: 'beginner',
      children: [
        {
          id: 'old-1-1',
          label: 'Node A1',
          summary: 'Summary A1',
          difficulty: 'beginner',
        },
        {
          id: 'old-1-2',
          label: 'Node A2',
          summary: 'Summary A2',
          difficulty: 'intermediate',
        },
      ],
    },
    {
      id: 'old-2',
      label: 'Node B',
      summary: 'Summary B',
      difficulty: 'advanced',
    },
  ];

  describe('reassignIds', () => {
    it('應將節點 ID 重新分配為 1, 1.1, 1.2, 2 格式', () => {
      const result = reassignIds(sampleNodes);
      expect(result[0]?.id).toBe('1');
      expect(result[0]?.children?.[0]?.id).toBe('1.1');
      expect(result[0]?.children?.[1]?.id).toBe('1.2');
      expect(result[1]?.id).toBe('2');
    });

    it('空節點陣列應回傳空陣列', () => {
      expect(reassignIds([])).toEqual([]);
    });
  });

  describe('dedupeNodes', () => {
    it('應移除同層具有重複 label 的節點', () => {
      const duplicateNodes: MapNode[] = [
        { id: '1', label: 'Docker 基礎', summary: 'S1', difficulty: 'beginner' },
        { id: '2', label: 'Docker 基礎', summary: 'S2', difficulty: 'beginner' },
        { id: '3', label: 'Dockerfile 語法', summary: 'S3', difficulty: 'intermediate' },
      ];
      const deduped = dedupeNodes(duplicateNodes);
      expect(deduped).toHaveLength(2);
      expect(deduped.map((n) => n.label)).toEqual(['Docker 基礎', 'Dockerfile 語法']);
    });
  });

  describe('flattenTree & countLearningNodes', () => {
    const root: MapNode = {
      id: '0',
      label: 'Root Topic',
      summary: 'Root summary',
      difficulty: 'beginner',
      children: sampleNodes,
    };

    it('walkTree 應走訪包含根節點在內的全部節點', () => {
      const visited: string[] = [];
      walkTree(root, (node) => {
        visited.push(node.id);
      });
      expect(visited).toEqual(['0', 'old-1', 'old-1-1', 'old-1-2', 'old-2']);
    });

    it('flattenTree 預設不包含根節點', () => {
      const flat = flattenTree(root);
      expect(flat).toHaveLength(4); // A, A1, A2, B
      expect(flat.map((n) => n.label)).toEqual(['Node A', 'Node A1', 'Node A2', 'Node B']);
    });

    it('flattenTree(includeRoot: true) 包含根節點', () => {
      const flat = flattenTree(root, true);
      expect(flat).toHaveLength(5);
      expect(flat[0]?.id).toBe('0');
    });

    it('countLearningNodes 只計算非 0 節點數量', () => {
      expect(countLearningNodes(root)).toBe(4);
    });
  });

  describe('findNode & getNodePath', () => {
    const root: MapNode = {
      id: '0',
      label: 'Root Topic',
      summary: 'Root summary',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Chapter 1',
          summary: 'S1',
          difficulty: 'beginner',
          children: [
            {
              id: '1.1',
              label: 'Section 1.1',
              summary: 'S1.1',
              difficulty: 'intermediate',
            },
          ],
        },
      ],
    };

    it('findNode 應能尋找根節點及任意深度的子節點', () => {
      expect(findNode(root, '0')?.label).toBe('Root Topic');
      expect(findNode(root, '1')?.label).toBe('Chapter 1');
      expect(findNode(root, '1.1')?.label).toBe('Section 1.1');
      expect(findNode(root, 'non-existent')).toBeNull();
    });

    it('getNodePath 應回傳從根節點到目標節點的路徑', () => {
      const path = getNodePath(root, '1.1');
      expect(path.map((n) => n.id)).toEqual(['0', '1', '1.1']);
      expect(path.map((n) => n.label)).toEqual(['Root Topic', 'Chapter 1', 'Section 1.1']);
    });

    it('若目標不存在，getNodePath 應回傳空陣列', () => {
      expect(getNodePath(root, '999')).toEqual([]);
    });
  });

  describe('trimTree', () => {
    it('應根據 maxDepth 限制深度（depth 0 是根節點，maxDepth=2 保留至 1.1）', () => {
      const deepRoot: MapNode = {
        id: '0',
        label: 'Root',
        summary: 'Root',
        difficulty: 'beginner',
        children: [
          {
            id: '1',
            label: 'L1',
            summary: 'L1',
            difficulty: 'beginner',
            children: [
              {
                id: '1.1',
                label: 'L2',
                summary: 'L2',
                difficulty: 'beginner',
                children: [
                  {
                    id: '1.1.1',
                    label: 'L3',
                    summary: 'L3',
                    difficulty: 'beginner',
                  },
                ],
              },
            ],
          },
        ],
      };

      const trimmed = trimTree(deepRoot, { maxDepth: 2, maxBreadth: 5, maxNodes: 30 });
      const flat = flattenTree(trimmed);
      expect(flat.map((n) => n.id)).toEqual(['1', '1.1']);
      expect(findNode(trimmed, '1.1.1')).toBeNull();
    });

    it('應根據 maxBreadth 限制每層子節點廣度', () => {
      const wideRoot: MapNode = {
        id: '0',
        label: 'Root',
        summary: 'Root',
        difficulty: 'beginner',
        children: [
          { id: '1', label: 'C1', summary: 'S', difficulty: 'beginner' },
          { id: '2', label: 'C2', summary: 'S', difficulty: 'beginner' },
          { id: '3', label: 'C3', summary: 'S', difficulty: 'beginner' },
          { id: '4', label: 'C4', summary: 'S', difficulty: 'beginner' },
        ],
      };

      const trimmed = trimTree(wideRoot, { maxDepth: 3, maxBreadth: 2, maxNodes: 30 });
      expect(trimmed.children).toHaveLength(2);
      expect(trimmed.children?.map((c) => c.id)).toEqual(['1', '2']);
    });

    it('應根據 maxNodes 限制總學習節點數（優先剪除最深葉節點）', () => {
      const bigTree: MapNode = {
        id: '0',
        label: 'Root',
        summary: 'Root',
        difficulty: 'beginner',
        children: [
          {
            id: '1',
            label: 'C1',
            summary: 'S1',
            difficulty: 'beginner',
            children: [
              { id: '1.1', label: 'C1.1', summary: 'S', difficulty: 'beginner' },
              { id: '1.2', label: 'C1.2', summary: 'S', difficulty: 'beginner' },
            ],
          },
          {
            id: '2',
            label: 'C2',
            summary: 'S2',
            difficulty: 'beginner',
            children: [
              { id: '2.1', label: 'C2.1', summary: 'S', difficulty: 'beginner' },
              { id: '2.2', label: 'C2.2', summary: 'S', difficulty: 'beginner' },
            ],
          },
        ],
      };
      // 目前有 6 個學習節點：1, 1.1, 1.2, 2, 2.1, 2.2
      // 限制 maxNodes 為 4
      const trimmed = trimTree(bigTree, { maxDepth: 5, maxBreadth: 5, maxNodes: 4 });
      expect(countLearningNodes(trimmed)).toBeLessThanOrEqual(4);
    });
  });

  describe('createMapFromResponse', () => {
    it('應合成根節點 id: "0"、重新分配子節點 ID、套用裁切並返回 LearningMap', () => {
      const response: MapGenerationResponse = {
        title: 'Kubernetes 入門',
        summary: '全面掌握 K8s 容器編排核心能力',
        nodes: [
          {
            id: 'x1',
            label: 'Pod 與 Deployment',
            summary: '基礎資源管理',
            difficulty: 'beginner',
          },
          {
            id: 'x2',
            label: 'Service 與 Ingress',
            summary: '網路連線',
            difficulty: 'intermediate',
          },
        ],
      };

      const options: GenerationOptions = {
        maxDepth: 3,
        maxBreadth: 5,
        maxNodes: 30,
        temperature: 0.4,
        level: 'beginner',
        language: 'zh-TW',
      };

      const map = createMapFromResponse('Kubernetes', response, options, 'openai', 'gpt-4o-mini');

      expect(map.id).toBeDefined();
      expect(map.schemaVersion).toBe(1);
      expect(map.topic).toBe('Kubernetes');
      expect(map.title).toBe('Kubernetes 入門');
      expect(map.summary).toBe('全面掌握 K8s 容器編排核心能力');
      expect(map.root.id).toBe('0');
      expect(map.root.label).toBe('Kubernetes');
      expect(map.root.children?.[0]?.id).toBe('1');
      expect(map.root.children?.[1]?.id).toBe('2');
      expect(map.providerId).toBe('openai');
      expect(map.modelId).toBe('gpt-4o-mini');
      expect(map.createdAt).toBeGreaterThan(0);
    });
  });

  describe('getNodeParent & getNodeSiblings', () => {
    const testRoot: MapNode = {
      id: '0',
      label: 'Root',
      summary: 'Root summary',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Child 1',
          summary: 'Summary 1',
          difficulty: 'beginner',
          children: [
            {
              id: '1.1',
              label: 'Grandchild 1.1',
              summary: 'Summary 1.1',
              difficulty: 'intermediate',
            },
            {
              id: '1.2',
              label: 'Grandchild 1.2',
              summary: 'Summary 1.2',
              difficulty: 'intermediate',
            },
          ],
        },
        {
          id: '2',
          label: 'Child 2',
          summary: 'Summary 2',
          difficulty: 'advanced',
        },
      ],
    };

    it('應正確找出節點的直接父節點', () => {
      const parentOf1 = getNodeParent(testRoot, '1');
      expect(parentOf1?.id).toBe('0');

      const parentOf11 = getNodeParent(testRoot, '1.1');
      expect(parentOf11?.id).toBe('1');

      const parentOfRoot = getNodeParent(testRoot, '0');
      expect(parentOfRoot).toBeNull();
    });

    it('應正確找出節點的同層兄弟節點、前順位與後順位', () => {
      const siblings11 = getNodeSiblings(testRoot, '1.1');
      expect(siblings11.prevSibling).toBeNull();
      expect(siblings11.nextSibling?.id).toBe('1.2');
      expect(siblings11.siblings).toHaveLength(1);
      expect(siblings11.siblings[0]?.id).toBe('1.2');

      const siblings12 = getNodeSiblings(testRoot, '1.2');
      expect(siblings12.prevSibling?.id).toBe('1.1');
      expect(siblings12.nextSibling).toBeNull();

      const siblingsRoot = getNodeSiblings(testRoot, '0');
      expect(siblingsRoot.parent).toBeNull();
      expect(siblingsRoot.siblings).toHaveLength(0);
    });
  });

  describe('addChildNodes', () => {
    it('應能將新子節點正確掛載到指定節點底下並重新分配階層 ID', () => {
      const root: MapNode = {
        id: '0',
        label: '主題',
        summary: '摘要',
        difficulty: 'beginner',
        children: [
          {
            id: '1',
            label: '單元 1',
            summary: '單元 1 摘要',
            difficulty: 'beginner',
            children: [
              { id: '1.1', label: '子單元 1.1', summary: '摘要', difficulty: 'beginner' },
            ],
          },
        ],
      };

      const newRoot = addChildNodes(root, '1', [
        { label: '新子單元 A', summary: '新摘要 A', difficulty: 'intermediate' },
        { label: '新子單元 B', summary: '新摘要 B', difficulty: 'advanced' },
      ]);

      const node1 = findNode(newRoot, '1');
      expect(node1?.children).toHaveLength(3);
      expect(node1?.children?.[1]?.id).toBe('1.2');
      expect(node1?.children?.[1]?.label).toBe('新子單元 A');
      expect(node1?.children?.[2]?.id).toBe('1.3');
      expect(node1?.children?.[2]?.label).toBe('新子單元 B');
    });

    it('若掛載至根節點 0，應新增頂層子單元', () => {
      const root: MapNode = {
        id: '0',
        label: '主題',
        summary: '摘要',
        difficulty: 'beginner',
        children: [
          { id: '1', label: '單元 1', summary: '摘要', difficulty: 'beginner' },
        ],
      };

      const newRoot = addChildNodes(root, '0', [
        { label: '單元 2', summary: '摘要 2', difficulty: 'intermediate' },
      ]);

      expect(newRoot.children).toHaveLength(2);
      expect(newRoot.children?.[1]?.id).toBe('2');
      expect(newRoot.children?.[1]?.label).toBe('單元 2');
    });
  });

  describe('removeNode & getSubtreeNodeIds', () => {
    const testTree: MapNode = {
      id: '0',
      label: 'Root',
      summary: 'Root summary',
      difficulty: 'beginner',
      children: [
        {
          id: '1',
          label: 'Node 1',
          summary: 'Summary 1',
          difficulty: 'beginner',
          children: [
            { id: '1.1', label: 'Child 1.1', summary: 'Sub 1.1', difficulty: 'beginner' },
            { id: '1.2', label: 'Child 1.2', summary: 'Sub 1.2', difficulty: 'intermediate' },
          ],
        },
        {
          id: '2',
          label: 'Node 2',
          summary: 'Summary 2',
          difficulty: 'advanced',
        },
      ],
    };

    it('getSubtreeNodeIds 應取得自身與所有子孫 ID', () => {
      const ids = getSubtreeNodeIds(testTree, '1');
      expect(ids).toEqual(['1', '1.1', '1.2']);
    });

    it('removeNode 應連帶刪除目標節點及其所有子節點，並重新分配編號', () => {
      const newTree = removeNode(testTree, '1');
      expect(newTree.children).toHaveLength(1);
      // 原本的 Node 2 被重新分配為 1
      expect(newTree.children?.[0]?.label).toBe('Node 2');
      expect(newTree.children?.[0]?.id).toBe('1');
    });

    it('刪除葉節點時不影響其父節點其他兄弟', () => {
      const newTree = removeNode(testTree, '1.1');
      const node1 = findNode(newTree, '1');
      expect(node1?.children).toHaveLength(1);
      expect(node1?.children?.[0]?.label).toBe('Child 1.2');
      expect(node1?.children?.[0]?.id).toBe('1.1'); // 重新分配為 1.1
    });

    it('不允許刪除根節點 0', () => {
      const newTree = removeNode(testTree, '0');
      expect(newTree.id).toBe('0');
      expect(newTree.children).toHaveLength(2);
    });
  });
});

