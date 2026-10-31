import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  AlertCircle,
  ArrowLeft,
  Loader2,
  PartyPopper,
  Download,
  FileText,
  FileCode,
  Network,
  ListOrdered,
  Share2,
  ChevronDown,
  Database,
} from 'lucide-react';

import type { LearningMap, NodeProgress, NodeStatus, MapNode } from '@/domain/types';
import { countLearningNodes, findNode, addChildNodes, removeNode, getSubtreeNodeIds } from '@/domain/tree';
import { generateMapMarkdown } from '@/domain/export/markdown';
import { generateMapOpml } from '@/domain/export/opml';
import { generateMapHtml } from '@/domain/export/html';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import { lessonsRepo } from '@/lib/db/repos/lessons';
import { createBackupData, downloadBackupFile, downloadBlob } from '@/lib/storage/backup';
import { LessonDrawer } from '@/features/lesson/LessonDrawer';
import { MapCanvas } from './MapCanvas';
import { AddSubtreeModal } from './AddSubtreeModal';
import { ShareMapModal } from './ShareMapModal';

interface OutletContextType {
  setMapInfo?: (info: { title: string; progressPercent: number; isVisible: boolean } | null) => void;
}

export function MapPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { setMapInfo } = useOutletContext<OutletContextType>() || {};

  const [map, setMap] = useState<LearningMap | null>(null);
  const [progressList, setProgressList] = useState<NodeProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 選中節點（開啟教學抽屜）
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 100% 完成低調慶祝狀態
  const [showCelebration, setShowCelebration] = useState(false);

  // OPML 匯出指引通知
  const [opmlNotice, setOpmlNotice] = useState(false);

  // 順序學習模式開關（預設開啟）
  const [orderMode, setOrderMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mapcraft.orderMode');
        if (saved !== null) return saved === 'true';
      } catch {
        // ignore
      }
    }
    return true;
  });

  // 目標新增分支之節點
  const [subtreeTargetNode, setSubtreeTargetNode] = useState<MapNode | null>(null);

  // 分享地圖彈窗開關
  const [isShareOpen, setIsShareOpen] = useState(false);

  // 匯出選單開關與點擊外部關閉
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExportOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportOpen]);

  // 1. 載入地圖與進度
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!id) return;
      setIsLoading(true);
      setError(null);

      try {
        const loadedMap = await mapsRepo.getById(id);
        if (!isMounted) return;

        if (!loadedMap) {
          setMap(null);
          setIsLoading(false);
          return;
        }

        setMap(loadedMap);

        const loadedProgress = await progressRepo.getByMapId(id);
        if (!isMounted) return;
        setProgressList(loadedProgress);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    const handleCloudSynced = () => {
      if (!id) return;
      void (async () => {
        const latestMap = await mapsRepo.getById(id);
        const latestProgress = await progressRepo.getByMapId(id);
        if (isMounted && latestMap) {
          setMap(latestMap);
          setProgressList(latestProgress);
        }
      })();
    };

    window.addEventListener('mapcraft:cloud-synced', handleCloudSynced);

    return () => {
      isMounted = false;
      window.removeEventListener('mapcraft:cloud-synced', handleCloudSynced);
      setMapInfo?.(null);
    };
  }, [id, setMapInfo]);

  // 2. 建立節點狀態速查表
  const progressMap = useMemo(() => {
    const mapRecord: Record<string, NodeStatus> = {};
    for (const item of progressList) {
      mapRecord[item.nodeId] = item.status;
    }
    return mapRecord;
  }, [progressList]);

  // 3. 計算總學習節點數與完成百分比
  const { totalCount, doneCount, percent } = useMemo(() => {
    if (!map) return { totalCount: 0, doneCount: 0, percent: 0 };
    const total = countLearningNodes(map.root);
    const done = progressList.filter((p) => p.status === 'done').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { totalCount: total, doneCount: done, percent: pct };
  }, [map, progressList]);

  // 4. 同步更新頂部導覽列標題與進度
  useEffect(() => {
    if (map) {
      setMapInfo?.({
        title: map.title,
        progressPercent: percent,
        isVisible: true,
      });
    }
  }, [map, percent, setMapInfo]);

  // 5. 節點狀態機切換（todo ↔ learning ↔ done）
  const handleUpdateStatus = useCallback(
    async (nodeId: string, nextStatus: NodeStatus) => {
      if (!map) return;

      const now = Date.now();
      const existing = progressList.find((p) => p.nodeId === nodeId);

      const updatedItem: NodeProgress = {
        mapId: map.id,
        nodeId,
        status: nextStatus,
        attempts: existing?.attempts || 0,
        correct: existing?.correct || 0,
        updatedAt: now,
      };

      const nextList = existing
        ? progressList.map((p) => (p.nodeId === nodeId ? updatedItem : p))
        : [...progressList, updatedItem];

      setProgressList(nextList);
      await progressRepo.save(updatedItem);

      // 低調慶祝檢驗：若更新後全數完成且原本未慶祝
      const total = countLearningNodes(map.root);
      const doneTotal = nextList.filter((p) => p.status === 'done').length;
      if (doneTotal === total && total > 0) {
        setShowCelebration(true);
      }
    },
    [map, progressList]
  );

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // 開啟新增子分支彈窗
  const handleOpenAddChild = useCallback(
    (nodeId: string) => {
      if (!map) return;
      const target = findNode(map.root, nodeId);
      if (target) {
        setSubtreeTargetNode(target);
      }
    },
    [map]
  );

  // 確認新增子分支並持久化
  const handleSubtreeAdded = useCallback(
    async (newChildren: (Omit<MapNode, 'id'> & { id?: string })[]) => {
      if (!map || !subtreeTargetNode) return;

      const newRoot = addChildNodes(map.root, subtreeTargetNode.id, newChildren);
      const updatedMap: LearningMap = {
        ...map,
        root: newRoot,
        updatedAt: Date.now(),
      };

      try {
        await mapsRepo.save(updatedMap);
        setMap(updatedMap);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [map, subtreeTargetNode]
  );

  // 移除指定節點（連帶刪除子樹，並跳出確認警示窗）
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!map || nodeId === '0') return;
      const target = findNode(map.root, nodeId);
      if (!target) return;

      const subtreeIds = getSubtreeNodeIds(map.root, nodeId);
      const childrenCount = subtreeIds.length - 1;

      const confirmMsg =
        childrenCount > 0
          ? t('map.deleteNodeConfirmSubtree', { label: target.label, count: childrenCount })
          : t('map.deleteNodeConfirmSingle', { label: target.label });

      if (!window.confirm(confirmMsg)) {
        return;
      }

      const newRoot = removeNode(map.root, nodeId);
      const updatedMap: LearningMap = {
        ...map,
        root: newRoot,
        updatedAt: Date.now(),
      };

      try {
        await mapsRepo.save(updatedMap);
        setMap(updatedMap);

        // 若抽屜開啟中的節點在被刪除的子樹內，自動關閉抽屜
        if (selectedNodeId && subtreeIds.includes(selectedNodeId)) {
          setSelectedNodeId(null);
        }

        // 清理被刪除子樹的進度與教材快取
        for (const id of subtreeIds) {
          await progressRepo.delete(map.id, id);
          await lessonsRepo.delete(map.id, id);
        }

        const newProgress = await progressRepo.getByMapId(map.id);
        setProgressList(newProgress);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [map, selectedNodeId, t]
  );

  // 鍵盤 Esc 關閉抽屜
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 狀態 1：載入中（Loading）
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  // 狀態 2：發生錯誤（Error）
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-rose-900 dark:text-rose-200">
          {t('common.error')}
        </h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 max-w-md">{error}</p>
        <Link
          to="/library"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('nav.library')}</span>
        </Link>
      </div>
    );
  }

  // 狀態 3：查無地圖（Empty）
  if (!map) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <MapPin className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          {t('errors.notFoundTitle')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('errors.notFoundDesc')}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span>{t('nav.library')}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            <Network className="h-3.5 w-3.5" />
            <span>{t('nav.newCraft')}</span>
          </Link>
        </div>
      </div>
    );
  }

  // 匯出 Markdown 筆記
  const handleExportMarkdown = async () => {
    if (!map) return;
    try {
      const lessons = await lessonsRepo.getByMapId(map.id);
      const mdContent = generateMapMarkdown(map, progressList, lessons);
      const safeTitle = map.title.replace(/[\\/:*?"<>|]/g, '_');
      downloadBlob(`${safeTitle}.md`, mdContent, 'text/markdown;charset=utf-8');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 匯出單一獨立 HTML 互動手冊
  const handleExportHtml = async () => {
    if (!map) return;
    try {
      const lessons = await lessonsRepo.getByMapId(map.id);
      const htmlContent = generateMapHtml(map, progressList, lessons);
      const safeTitle = map.title.replace(/[\\/:*?"<>|]/g, '_');
      downloadBlob(`${safeTitle}.html`, htmlContent, 'text/html;charset=utf-8');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 匯出單張地圖備份
  const handleExportBackup = async () => {
    if (!map) return;
    try {
      const backup = await createBackupData(map.id);
      const safeTitle = map.title.replace(/[\\/:*?"<>|]/g, '_');
      downloadBackupFile(backup, safeTitle);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 匯出 OPML 心智圖
  const handleExportOpml = () => {
    if (!map) return;
    try {
      const opmlContent = generateMapOpml(map, progressList);
      const safeTitle = map.title.replace(/[\\/:*?"<>|]/g, '_');
      downloadBlob(`${safeTitle}.opml`, opmlContent, 'text/xml;charset=utf-8');
      setOpmlNotice(true);
      setTimeout(() => setOpmlNotice(false), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 切換順序模式
  const handleToggleOrderMode = () => {
    setOrderMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mapcraft.orderMode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 狀態 4：正常成功渲染畫布與抽屜（Success）
  return (
    <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
      {/* 畫布本體 */}
      <div className="absolute inset-0 w-full h-full">
        <MapCanvas
          map={map}
          progressMap={progressMap}
          selectedNodeId={selectedNodeId}
          orderMode={orderMode}
          onSelectNode={handleSelectNode}
          onAddChild={handleOpenAddChild}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* 左上角：學習狀態與模式看板 */}
      <div className="absolute top-4 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
        <div className="min-w-44 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm shadow-slate-900/5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-200">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              {t('topbar.progressLabel', {
                done: doneCount,
                total: totalCount,
                percent,
              })}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* 順序模式切換按鈕 */}
        <button
          type="button"
          onClick={handleToggleOrderMode}
          title={orderMode ? t('map.orderModeOn') : t('map.orderModeOff')}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md transition-all cursor-pointer ${orderMode
              ? 'border-emerald-400 bg-emerald-50/95 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90 bg-white/90 text-slate-600 hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-400'
            }`}
        >
          <ListOrdered className="h-3.5 w-3.5 text-emerald-600" />
          <span>{t('map.orderMode')}</span>
        </button>
      </div>

      {/* 底部浮動操作：整合式匯出與分享 */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        {/* 整合式匯出選單 */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setIsExportOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={isExportOpen}
            aria-label={t('map.exportMenu')}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs backdrop-blur-md transition-all cursor-pointer ${isExportOpen
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                : 'border-slate-200/90 bg-white/90 text-slate-700 hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">{t('map.exportMenu')}</span>
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* 向上彈出格式選擇選單 (Popover) */}
          {isExportOpen && (
            <div
              role="menu"
              aria-orientation="vertical"
              className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                {t('map.exportMenuTitle')}
              </div>
              <div className="space-y-0.5">
                {/* 1. HTML 互動手冊（推薦） */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportOpen(false);
                    handleExportHtml();
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <FileCode className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {t('map.exportHtml')}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                        {t('map.recommended')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {t('map.exportHtmlDesc')}
                    </p>
                  </div>
                </button>

                {/* 2. Markdown 筆記 */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportOpen(false);
                    handleExportMarkdown();
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t('map.exportMarkdown')}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {t('map.exportMarkdownDesc')}
                    </p>
                  </div>
                </button>

                {/* 3. OPML 心智圖 */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportOpen(false);
                    handleExportOpml();
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <Network className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t('map.exportOpml')}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {t('map.exportOpmlDesc')}
                    </p>
                  </div>
                </button>

                {/* 4. 地圖備份（JSON） */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsExportOpen(false);
                    handleExportBackup();
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t('map.exportBackup')}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {t('map.exportBackupDesc')}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 分享按鈕 */}
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          aria-label={t('share.shareBtn')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('share.shareBtn')}</span>
          <span className="sm:hidden">{t('share.shareBtnShort')}</span>
        </button>
      </div>

      {/* 低調慶祝橫條（全數完成時顯示） */}
      {showCelebration && (
        <div
          role="status"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-full border border-emerald-300 bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg animate-bounce"
        >
          <PartyPopper className="h-4 w-4" />
          <span>{t('map.allDoneCelebration')}</span>
          <button
            type="button"
            onClick={() => setShowCelebration(false)}
            className="ml-1 text-emerald-100 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* OPML 匯出指引通知 */}
      {opmlNotice && (
        <div
          role="status"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-lg"
        >
          <span>{t('map.opmlNoticeDesc')}</span>
          <button
            type="button"
            onClick={() => setOpmlNotice(false)}
            className="ml-2 text-sky-200 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 節點微教學抽屜（FR-04） */}
      {selectedNodeId && (
        <LessonDrawer
          map={map}
          nodeId={selectedNodeId}
          status={progressMap[selectedNodeId] || 'todo'}
          onClose={handleCloseDrawer}
          onUpdateStatus={handleUpdateStatus}
          onSelectNode={handleSelectNode}
          onDeleteNode={handleDeleteNode}
        />
      )}

      {/* 新增子分支彈窗（AI 生成 vs 手動輸入） */}
      {subtreeTargetNode && (
        <AddSubtreeModal
          map={map}
          targetNode={subtreeTargetNode}
          isOpen={Boolean(subtreeTargetNode)}
          onClose={() => setSubtreeTargetNode(null)}
          onSubtreeAdded={handleSubtreeAdded}
        />
      )}

      {/* 分享地圖彈窗（方案 B 網址直接分享 + 方案 A Google Drive 雲端分享） */}
      <ShareMapModal
        map={map}
        progressList={progressList}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}

export default MapPage;
