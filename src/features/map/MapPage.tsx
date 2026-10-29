import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  AlertCircle,
  Compass,
  ArrowLeft,
  Loader2,
  PartyPopper,
  Download,
  FileText,
  FileCode,
  Network,
  ListOrdered,
  Share2,
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
            <Compass className="h-3.5 w-3.5" />
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

      {/* 底部浮動資訊列與匯出操作 */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:text-slate-300">
          <span className="font-medium">
            {t('topbar.progressLabel', {
              done: doneCount,
              total: totalCount,
              percent,
            })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-[11px] text-slate-400">{t('map.clickNodeHint')}</span>
        </div>

        {/* 順序模式切換按鈕 */}
        <button
          type="button"
          onClick={handleToggleOrderMode}
          title={orderMode ? t('map.orderModeOn') : t('map.orderModeOff')}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs backdrop-blur-md transition-all ${
            orderMode
              ? 'border-emerald-400 bg-emerald-50/90 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
              : 'border-slate-200/90 bg-white/90 text-slate-600 hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-400'
          }`}
        >
          <ListOrdered className="h-3.5 w-3.5 text-emerald-600" />
          <span>{t('map.orderMode')}</span>
        </button>

        {/* 匯出操作按鈕 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            aria-label={t('map.exportMarkdown')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t('map.exportMarkdown')}</span>
            <span className="sm:hidden">Markdown</span>
          </button>

          <button
            type="button"
            onClick={handleExportHtml}
            aria-label={t('map.exportHtml')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileCode className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t('map.exportHtml')}</span>
            <span className="sm:hidden">HTML</span>
          </button>

          <button
            type="button"
            onClick={handleExportOpml}
            aria-label={t('map.exportOpml')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Network className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t('map.exportOpml')}</span>
            <span className="sm:hidden">OPML</span>
          </button>

          <button
            type="button"
            onClick={handleExportBackup}
            aria-label={t('map.exportBackup')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t('map.exportBackup')}</span>
            <span className="sm:hidden">備份</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            aria-label={t('share.shareBtn')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('share.shareBtn')}</span>
            <span className="sm:hidden">{t('share.shareBtnShort')}</span>
          </button>
        </div>
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
