import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle2, Circle, ChevronRight, ChevronDown, Plus, Lightbulb, Trash2 } from 'lucide-react';
import type { LayoutNodeData } from '@/domain/layout';
import type { NodeStatus } from '@/domain/types';

export interface NodeCardCustomData extends LayoutNodeData {
  status?: NodeStatus;
  selected?: boolean;
  orderMode?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  onAddChild?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  [key: string]: unknown;
}

export type MapCustomNode = Node<NodeCardCustomData, 'mapNode'>;

const DIFFICULTY_BADGES = {
  beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  intermediate: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  advanced: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
};

export const NodeCard = memo(function NodeCard({ data }: NodeProps<MapCustomNode>) {
  const { t } = useTranslation();

  if (!data || !data.node) {
    return null;
  }

  const {
    node,
    isRoot,
    hasChildren,
    childrenCount,
    isCollapsed,
    status = 'todo',
    selected = false,
    orderMode = true,
    onToggleCollapse,
    onSelectNode,
    onAddChild,
    onDeleteNode,
  } = data;

  const difficulty = node.difficulty || 'beginner';
  const badgeStyle = DIFFICULTY_BADGES[difficulty] || DIFFICULTY_BADGES.beginner;
  const difficultyLabel =
    difficulty === 'intermediate'
      ? t('nodeCard.difficultyIntermediate')
      : difficulty === 'advanced'
        ? t('nodeCard.difficultyAdvanced')
        : t('nodeCard.difficultyBeginner');

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
          onSelectNode?.(node.id);
        }
      }}
      className={`group relative flex h-[90px] w-[260px] flex-col justify-between rounded-xl border p-3 text-left shadow-xs transition-all duration-150 select-none cursor-pointer active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isRoot
          ? 'border-emerald-500 bg-emerald-50/80 shadow-emerald-500/10 dark:border-emerald-500 dark:bg-emerald-950/50'
          : selected
            ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-md dark:border-emerald-400 dark:bg-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700'
      }`}
    >
      {/* 快捷新增分支按鈕（+） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild?.(node.id);
        }}
        title={t('nodeCard.addChildAria')}
        aria-label={t('nodeCard.addChildAria')}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400 bg-white text-emerald-600 shadow-sm transition-all hover:scale-110 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 focus:opacity-100 dark:border-emerald-600 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-slate-800"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* React Flow 左側接點（根節點無輸入） */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400 dark:!border-slate-900 dark:!bg-slate-500"
        />
      )}

      {/* 頂部：標題與狀態指示/刪除按鈕 */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex items-center gap-1.5">
          {/* 順序模式序號徽章 */}
          {orderMode && !isRoot && (
            <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              #{node.id}
            </span>
          )}
          <h4
            className="line-clamp-1 font-semibold text-xs sm:text-sm text-slate-900 dark:text-white"
            title={node.label}
          >
            {node.label}
          </h4>
        </div>

        {/* 頂部右側：學習狀態指示與移除按鈕 */}
        {!isRoot && (
          <div className="flex items-center gap-1 shrink-0">
            {status === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label={t('nodeCard.statusDone')} />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label={t('nodeCard.statusTodo')} />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode?.(node.id);
              }}
              title={t('nodeCard.deleteAria')}
              aria-label={t('nodeCard.deleteAria')}
              className="flex h-5 w-5 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all dark:text-slate-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 中間：簡短摘要 */}
      <p className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400" title={node.summary}>
        {node.summary}
      </p>

      {/* 底部：難度標籤、模式指示與收合切換按鈕 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badgeStyle}`}
          >
            {difficultyLabel}
          </span>
          {node.mode === 'brainstorm' && (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Lightbulb className="h-2.5 w-2.5" />
              <span>{t('nodeCard.brainstormBadge')}</span>
            </span>
          )}
        </div>

        {/* 展開/收合子樹切換按鈕 */}
        {hasChildren && (
          <button
            type="button"
            onClick={handleCollapseClick}
            aria-label={isCollapsed ? t('nodeCard.expandAria', { count: childrenCount }) : t('nodeCard.collapseAria')}
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
