import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle2, Circle, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import type { LayoutNodeData } from '@/domain/layout';
import type { NodeStatus } from '@/domain/types';

export interface NodeCardCustomData extends LayoutNodeData {
  status?: NodeStatus;
  selected?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  [key: string]: unknown;
}

export type MapCustomNode = Node<NodeCardCustomData, 'mapNode'>;

const DIFFICULTY_CONFIG = {
  beginner: {
    label: '入門',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  intermediate: {
    label: '進階',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
  advanced: {
    label: '精通',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
};

export const NodeCard = memo(function NodeCard({ data }: NodeProps<MapCustomNode>) {
  const {
    node,
    isRoot,
    hasChildren,
    childrenCount,
    isCollapsed,
    status = 'todo',
    selected = false,
    onToggleCollapse,
    onSelectNode,
  } = data;

  const diffConfig = DIFFICULTY_CONFIG[node.difficulty] || DIFFICULTY_CONFIG.beginner;

  const handleCardClick = () => {
    onSelectNode?.(node.id);
  };

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse?.(node.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`group relative flex h-[90px] w-[260px] flex-col justify-between rounded-xl border p-3 text-left shadow-xs transition-all duration-150 select-none cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isRoot
          ? 'border-emerald-500 bg-emerald-50/80 shadow-emerald-500/10 dark:border-emerald-500 dark:bg-emerald-950/50'
          : selected
            ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-md dark:border-emerald-400 dark:bg-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700'
      }`}
    >
      {/* React Flow 左側接點（根節點無輸入） */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400 dark:!border-slate-900 dark:!bg-slate-500"
        />
      )}

      {/* 頂部：標題與狀態指示 */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-1 font-semibold text-xs sm:text-sm text-slate-900 dark:text-white" title={node.label}>
          {node.label}
        </h4>

        {/* 學習狀態指示 */}
        {!isRoot && (
          <div className="shrink-0">
            {status === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="已完成" />
            ) : status === 'learning' ? (
              <Clock className="h-4 w-4 text-amber-500 animate-pulse" aria-label="學習中" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="未開始" />
            )}
          </div>
        )}
      </div>

      {/* 中間：簡短摘要 */}
      <p className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400" title={node.summary}>
        {node.summary}
      </p>

      {/* 底部：難度標籤與收合切換按鈕 */}
      <div className="flex items-center justify-between pt-1">
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${diffConfig.badge}`}
        >
          {diffConfig.label}
        </span>

        {/* 展開/收合子樹切換按鈕 */}
        {hasChildren && (
          <button
            type="button"
            onClick={handleCollapseClick}
            aria-label={isCollapsed ? `展開 ${childrenCount} 個子節點` : '收合子節點'}
            className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <span>{childrenCount}</span>
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* React Flow 右側接點（有子節點且未收合時） */}
      {hasChildren && !isCollapsed && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-emerald-500 dark:!border-slate-900"
        />
      )}
    </div>
  );
});
