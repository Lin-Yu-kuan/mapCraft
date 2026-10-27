import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Compass,
  ArrowRight,
  Clock,
  Loader2,
  AlertCircle,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';

import type { LearningMap, NodeProgress } from '@/domain/types';
import { countLearningNodes } from '@/domain/tree';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import { loadDemoCraft } from '@/lib/db';
import { createBackupData, downloadBackupFile, importBackupData } from '@/lib/storage/backup';

interface MapWithProgress {
  map: LearningMap;
  totalNodes: number;
  doneNodes: number;
  percent: number;
}

export function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState<MapWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 編輯標題狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 刪除確認狀態
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allMaps = await mapsRepo.getAll();
      const enriched: MapWithProgress[] = await Promise.all(
        allMaps.map(async (m) => {
          const progressList: NodeProgress[] = await progressRepo.getByMapId(m.id);
          const total = countLearningNodes(m.root);
          const done = progressList.filter((p) => p.status === 'done').length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return {
            map: m,
            totalNodes: total,
            doneNodes: done,
            percent: pct,
          };
        })
      );
      setItems(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // 搜尋過濾
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.map.title.toLowerCase().includes(q) ||
        item.map.topic.toLowerCase().includes(q) ||
        item.map.summary.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // 改名處理
  const startEdit = (e: React.MouseEvent, item: MapWithProgress) => {
    e.stopPropagation();
    setEditingId(item.map.id);
    setEditingTitle(item.map.title);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const saveEdit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const trimmed = editingTitle.trim();
    if (!trimmed) return;

    try {
      await mapsRepo.updateTitle(id, trimmed);
      setItems((prev) =>
        prev.map((item) =>
          item.map.id === id
            ? { ...item, map: { ...item.map, title: trimmed, updatedAt: Date.now() } }
            : item
        )
      );
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 刪除處理
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await mapsRepo.delete(id);
      setItems((prev) => prev.filter((item) => item.map.id !== id));
      setDeletingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 匯出全部備份
  const handleExportBackup = async () => {
    try {
      const backup = await createBackupData();
      downloadBackupFile(backup, 'mapcraft_all_backup');
      setSuccessMsg('備份檔案已成功下載！');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 匯入備份
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importBackupData(text);
      setSuccessMsg(
        t('library.importSuccess', {
          maps: res.mapsImported,
          progress: res.progressImported,
          lessons: res.lessonsImported,
        })
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadMaps();
    } catch (err: unknown) {
      setError(
        `${t('library.importFailed')} ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsLoading(true);
      const demoId = await loadDemoCraft(true);
      setSuccessMsg(t('library.demoLoaded'));
      await loadMaps();
      navigate(`/map/${demoId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
      {/* 隱藏的檔案選擇器 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.mapcraft.json"
        className="hidden"
      />

      {/* 標題欄 */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('library.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('library.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              <span>{t('library.exportBackup')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            <span>{t('library.importBackup')}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
          >
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('library.demoMapButton')}</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t('nav.newCraft')}</span>
          </Link>
        </div>
      </div>

      {/* 成功通知 */}
      {successMsg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* 錯誤通知 */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 搜尋欄 */}
      {items.length > 0 && (
        <div className="mt-6 relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm text-slate-800 shadow-2xs transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </div>
      )}

      {/* 載入中態 */}
      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
        </div>
      ) : items.length === 0 ? (
        /* 空狀態（Empty State） */
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <FolderKanban className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
            {t('library.emptyTitle')}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('library.emptyDesc')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 transition-all dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
            >
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('library.loadDemo')}</span>
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Compass className="h-4 w-4" />
              <span>{t('library.craftMap')}</span>
            </Link>
          </div>
        </div>
      ) : (
        /* 地圖清單（Success State） */
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isEditing = editingId === item.map.id;
            const isDeleting = deletingId === item.map.id;

            return (
              <div
                key={item.map.id}
                onClick={() => !isEditing && !isDeleting && navigate(`/map/${item.map.id}`)}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-800"
              >
                <div>
                  {/* 標籤與操作 */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {item.map.topic}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => saveEdit(e, item.map.id)}
                            aria-label={t('library.saveTitleAria')}
                            className="p-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            aria-label={t('library.cancelTitleAria')}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => startEdit(e, item)}
                            aria-label={t('library.editTitleAria')}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(item.map.id);
                            }}
                            aria-label={t('library.deleteMapAria')}
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 標題與簡介 */}
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(e as unknown as React.MouseEvent, item.map.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-lg border border-emerald-500 bg-white px-2 py-1 text-sm font-semibold text-slate-900 dark:bg-slate-900 dark:text-white"
                    />
                  ) : (
                    <h2 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors dark:text-white dark:group-hover:text-emerald-400">
                      {item.map.title}
                    </h2>
                  )}

                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {item.map.summary}
                  </p>
                </div>

                {/* 底部進度條與元資訊 */}
                <div className="mt-5 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{t('library.nodesCount', { count: item.totalNodes })}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.percent}%
                    </span>
                  </div>

                  {/* 進度條 */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.map.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform dark:text-emerald-400">
                      {t('library.enterMap')} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>

                {/* 刪除二階確認彈層 */}
                {isDeleting && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-white/95 p-4 text-center backdrop-blur-xs dark:bg-slate-950/95"
                  >
                    <Trash2 className="h-6 w-6 text-rose-500 mb-2" />
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t('library.deleteConfirm')}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.map.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                      >
                        {t('common.delete')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(null);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LibraryPage;
