import type {
  Difficulty,
  GenerationOptions,
  LearningMap,
  MapNode,
} from './types';
import type { MapGenerationResponse } from './schemas';

/**
 * 走訪樹狀節點
 */
export function walkTree(
  root: MapNode,
  callback: (node: MapNode, parent: MapNode | null, depth: number) => void,
  parent: MapNode | null = null,
  depth = 0
): void {
  callback(root, parent, depth);
  if (root.children && root.children.length > 0) {
    for (const child of root.children) {
      walkTree(child, callback, root, depth + 1);
    }
  }
}

/**
 * 將整棵樹展平為陣列
 * @param root 根節點
 * @param includeRoot 是否包含根節點（預設 false，只回傳學習節點）
 */
export function flattenTree(root: MapNode, includeRoot = false): MapNode[] {
  const result: MapNode[] = [];
  walkTree(root, (node) => {
    if (includeRoot || node.id !== '0') {
      result.push(node);
    }
  });
  return result;
}

/**
 * 計算學習節點總數（排除 id 為 "0" 的根節點）
 */
export function countLearningNodes(root: MapNode): number {
  return flattenTree(root, false).length;
}

/**
 * 依據 ID 搜尋節點
 */
export function findNode(root: MapNode, nodeId: string): MapNode | null {
  if (root.id === nodeId) return root;
  if (!root.children) return null;

  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * 取得從根節點到目標節點的完整路徑
 */
export function getNodePath(root: MapNode, nodeId: string): MapNode[] {
  const path: MapNode[] = [];

  function helper(current: MapNode): boolean {
    path.push(current);
    if (current.id === nodeId) {
      return true;
    }
    if (current.children) {
      for (const child of current.children) {
        if (helper(child)) return true;
      }
    }
    path.pop();
    return false;
  }

  if (helper(root)) {
    return path;
  }
  return [];
}

/**
 * 同層節點依據 label 去重（保留第一筆）
 */
export function dedupeNodes(nodes: MapNode[]): MapNode[] {
  const seen = new Set<string>();
  const deduped: MapNode[] = [];

  for (const node of nodes) {
    const key = node.label.trim();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({
        ...node,
        children: node.children ? dedupeNodes(node.children) : undefined,
      });
    }
  }

  return deduped;
}

/**
 * 本地重新分配節點 ID
 * 頂層: "1", "2", ...
 * 次層: "1.1", "1.2", ...
 * 第三層: "1.1.1", ...
 */
export function reassignIds(nodes: MapNode[], parentPrefix = ''): MapNode[] {
  return nodes.map((node, index) => {
    const currentId = parentPrefix ? `${parentPrefix}.${index + 1}` : `${index + 1}`;
    const nextNode: MapNode = {
      ...node,
      id: currentId,
    };
    if (node.children && node.children.length > 0) {
      nextNode.children = reassignIds(node.children, currentId);
    }
    return nextNode;
  });
}

/**
 * 裁切樹結構：限制深度、每層廣度與總學習節點數
 */
export function trimTree(
  root: MapNode,
  options: { maxDepth: number; maxBreadth: number; maxNodes: number }
): MapNode {
  const { maxDepth, maxBreadth, maxNodes } = options;

  // 1. 深度與廣度裁切（深拷貝同時限制）
  function pruneDepthAndBreadth(node: MapNode, currentDepth: number): MapNode {
    const isRoot = node.id === '0';
    const effectiveDepth = isRoot ? 0 : currentDepth;

    if (!node.children || node.children.length === 0) {
      return { ...node, children: undefined };
    }

    // 若子節點深度已超過 maxDepth，則捨棄子節點
    if (effectiveDepth >= maxDepth) {
      return { ...node, children: undefined };
    }

    // 限制廣度
    const slicedChildren = node.children.slice(0, maxBreadth);
    const prunedChildren = slicedChildren.map((child) =>
      pruneDepthAndBreadth(child, effectiveDepth + 1)
    );

    return {
      ...node,
      children: prunedChildren,
    };
  }

  const prunedRoot = pruneDepthAndBreadth(root, 0);

  // 2. 總節點數限制：若超過 maxNodes，由最深層的末尾葉節點開始移除
  let totalNodes = countLearningNodes(prunedRoot);

  if (totalNodes > maxNodes) {
    // 收集所有節點依深度由大到小排序
    while (totalNodes > maxNodes) {
      const candidates: { node: MapNode; parent: MapNode; depth: number }[] = [];

      walkTree(prunedRoot, (node, parent, depth) => {
        if (parent && (!node.children || node.children.length === 0)) {
          candidates.push({ node, parent, depth });
        }
      });

      if (candidates.length === 0) break;

      // 挑選深度最深、同深度中索引最大的葉節點
      candidates.sort((a, b) => b.depth - a.depth);
      const toRemove = candidates[0];
      if (!toRemove) break;

      if (toRemove.parent.children) {
        toRemove.parent.children = toRemove.parent.children.filter(
          (c) => c.id !== toRemove.node.id
        );
        if (toRemove.parent.children.length === 0) {
          toRemove.parent.children = undefined;
        }
      }

      totalNodes--;
    }
  }

  return prunedRoot;
}

/**
 * 組合 AI 回傳資料為本地 LearningMap 結構（合成根節點 id: "0"、重編 ID、裁切）
 */
export function createMapFromResponse(
  topic: string,
  response: MapGenerationResponse,
  options: GenerationOptions,
  providerId: string,
  modelId: string
): LearningMap {
  const dedupedChildren = dedupeNodes(response.nodes);
  const reassignedChildren = reassignIds(dedupedChildren);

  const rawRoot: MapNode = {
    id: '0',
    label: topic.trim(),
    summary: response.summary.trim(),
    difficulty: 'beginner' as Difficulty,
    children: reassignedChildren,
  };

  const trimmedRoot = trimTree(rawRoot, {
    maxDepth: options.maxDepth,
    maxBreadth: options.maxBreadth,
    maxNodes: options.maxNodes,
  });

  const now = Date.now();
  const mapId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `map_${now}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: mapId,
    schemaVersion: 1,
    title: response.title.trim() || topic.trim(),
    summary: response.summary.trim(),
    topic: topic.trim(),
    root: trimmedRoot,
    options,
    providerId,
    modelId,
    createdAt: now,
    updatedAt: now,
  };
}
