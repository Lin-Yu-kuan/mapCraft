import { hierarchy, tree } from 'd3-hierarchy';
import type { MapNode } from './types';

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 90;
export const HORIZONTAL_GAP = 80;
export const VERTICAL_GAP = 30;

export interface LayoutNodeData {
  node: MapNode;
  isRoot: boolean;
  hasChildren: boolean;
  childrenCount: number;
  isCollapsed: boolean;
}

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data: LayoutNodeData;
  type: string;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

interface HierarchyItem {
  node: MapNode;
  children?: HierarchyItem[];
}

/**
 * 依據收合狀態由左至右（LR）計算心智圖節點的樹狀座標與連線
 * 使用 d3-hierarchy 的 tree() 演算法，保證節點絕對不重疊
 *
 * @param root 根節點
 * @param collapsedIds 已收合的節點 ID 集合
 */
export function calculateTreeLayout(
  root: MapNode,
  collapsedIds: Set<string> = new Set()
): LayoutResult {
  // 1. 建立依據收合狀態裁剪後的虛擬樹
  function buildHierarchyItem(current: MapNode): HierarchyItem {
    const isCollapsed = collapsedIds.has(current.id);
    const hasChildren = Boolean(current.children && current.children.length > 0);

    return {
      node: current,
      children:
        hasChildren && !isCollapsed
          ? current.children!.map((child) => buildHierarchyItem(child))
          : undefined,
    };
  }

  const hierarchyTree = buildHierarchyItem(root);
  const rootHierarchy = hierarchy<HierarchyItem>(hierarchyTree);

  // 2. 配置 d3 tree 尺寸
  // d3 預設以 x 為兄弟節點展開維度，以 y 為深度維度
  const treeLayout = tree<HierarchyItem>().nodeSize([
    NODE_HEIGHT + VERTICAL_GAP,
    NODE_WIDTH + HORIZONTAL_GAP,
  ]);

  treeLayout(rootHierarchy);

  // 3. 以根節點（rootHierarchy）為基準錨點，確保展開或收合分支時根節點與全樹基準座標絕對穩定不跳動
  const rootY = rootHierarchy.x ?? 0;

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  // 4. 走訪計算後的層級結構，轉換成由左至右 (x = d.y, y = d.x - rootY)
  rootHierarchy.each((d) => {
    const item = d.data.node;
    const hasOriginalChildren = Boolean(item.children && item.children.length > 0);
    const originalChildrenCount = item.children ? item.children.length : 0;
    const isCollapsed = collapsedIds.has(item.id);
    const posX = d.y ?? 0;
    const posY = (d.x ?? 0) - rootY;

    nodes.push({
      id: item.id,
      position: {
        x: posX,
        y: posY,
      },
      data: {
        node: item,
        isRoot: item.id === '0',
        hasChildren: hasOriginalChildren,
        childrenCount: originalChildrenCount,
        isCollapsed,
      },
      type: 'mapNode',
    });

    if (d.parent) {
      edges.push({
        id: `e_${d.parent.data.node.id}_${item.id}`,
        source: d.parent.data.node.id,
        target: item.id,
        type: 'smoothstep',
      });
    }
  });

  return { nodes, edges };
}
