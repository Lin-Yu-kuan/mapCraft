import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, AlertCircle, Compass, ArrowLeft, Loader2 } from 'lucide-react';

import type { LearningMap, NodeProgress, NodeStatus } from '@/domain/types';
import { countLearningNodes } from '@/domain/tree';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import { MapCanvas } from './MapCanvas';

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

    return () => {
      isMounted = false;
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

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
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

  // 狀態 4：正常成功渲染畫布（Success）
  return (
    <div className="relative flex flex-1 flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {/* 畫布本體 */}
      <div className="relative flex-1 w-full h-full">
        <MapCanvas
          map={map}
          progressMap={progressMap}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
        />
      </div>

      {/* 底部浮動資訊列（小巧提示） */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:text-slate-300">
        <span className="font-medium">
          {t('topbar.progressLabel', {
            done: doneCount,
            total: totalCount,
            percent,
          })}
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="text-[11px] text-slate-400">點擊節點展開/收合或查看教學</span>
      </div>
    </div>
  );
}

export default MapPage;
