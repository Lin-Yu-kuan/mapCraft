import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { LearningMap, MapNode, NodeStatus } from '@/domain/types';
import { calculateTreeLayout } from '@/domain/layout';
import { walkTree } from '@/domain/tree';
import { getCollapsedStorageKey } from '@/lib/storage/keys';
import { NodeCard, type MapCustomNode } from './NodeCard';

interface MapCanvasProps {
  map: LearningMap;
  progressMap?: Record<string, NodeStatus>;
  selectedNodeId?: string | null;
  orderMode?: boolean;
  onSelectNode?: (nodeId: string) => void;
  onAddChild?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

const nodeTypes = {
  mapNode: NodeCard,
};

/**
 * 預設收合策略：預設展開 2 層（根節點為 depth 0，第 1 層展開，depth >= 2 預設收合）
 */
function getDefaultCollapsedIds(root: MapNode): Set<string> {
  const collapsed = new Set<string>();
  walkTree(root, (node, _parent, depth) => {
    // 若該節點有子節點且深度 >= 2，預設收合
    if (depth >= 2 && node.children && node.children.length > 0) {
      collapsed.add(node.id);
    }
  });
  return collapsed;
}

export function MapCanvas({
  map,
  progressMap = {},
  selectedNodeId = null,
  orderMode = true,
  onSelectNode,
  onAddChild,
  onDeleteNode,
}: MapCanvasProps) {
  // 1. 初始化收合狀態（先從 localStorage 讀取，若無則依預設展開 2 層策略）
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(getCollapsedStorageKey(map.id));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return new Set<string>(parsed);
          }
        }
      } catch {
        // 忽略解析失敗
      }
    }
    return getDefaultCollapsedIds(map.root);
  });

  // 2. 切換收合狀態並持久化至 localStorage
  const handleToggleCollapse = useCallback(
    (nodeId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              getCollapsedStorageKey(map.id),
              JSON.stringify(Array.from(next))
            );
          } catch {
            // ignore
          }
        }
        return next;
      });
    },
    [map.id]
  );

  // 3. 呼叫 layout 純函式計算樹狀座標與連線
  const { layoutNodes, layoutEdges } = useMemo(() => {
    const { nodes, edges } = calculateTreeLayout(map.root, collapsedIds);
    return { layoutNodes: nodes, layoutEdges: edges };
  }, [map.root, collapsedIds]);

  // 4. 將狀態與事件處理注入至 React Flow 節點
  const flowNodes: MapCustomNode[] = useMemo(() => {
    return layoutNodes.map((n) => ({
      id: n.id,
      position: n.position,
      type: 'mapNode' as const,
      data: {
        ...n.data,
        status: progressMap[n.id] || 'todo',
        selected: n.id === selectedNodeId,
        orderMode,
        onToggleCollapse: handleToggleCollapse,
        onSelectNode,
        onAddChild,
        onDeleteNode,
      },
    }));
  }, [layoutNodes, progressMap, selectedNodeId, orderMode, handleToggleCollapse, onSelectNode, onAddChild, onDeleteNode]);

  const flowEdges: Edge[] = useMemo(() => {
    return layoutEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      animated: false, // 移除虛線流動，全數採用乾淨專業實線
      style: {
        stroke: progressMap[e.target] === 'done' ? '#10b981' : '#94a3b8',
        strokeWidth: 2,
      },
    }));
  }, [layoutEdges, progressMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState<MapCustomNode>(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);

  // 當 flowNodes 或 flowEdges 計算更新時同步
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden bg-slate-50 dark:bg-slate-950"
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    >
      <ReactFlow<MapCustomNode, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => onSelectNode?.(node.id)}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" className="opacity-40 dark:opacity-20" />
        <Controls showInteractive={false} className="bg-white shadow-sm dark:bg-slate-900" />
      </ReactFlow>
    </div>
  );
}
