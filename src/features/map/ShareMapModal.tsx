import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Share2,
  X,
  Copy,
  Check,
  Cloud,
  Link2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Settings,
} from 'lucide-react';
import type { LearningMap, NodeProgress, Lesson } from '@/domain/types';
import { encodeSharePayload, buildShareUrl } from '@/domain/share';
import { lessonsRepo } from '@/lib/db/repos/lessons';
import {
  getGoogleDriveToken,
  publishMapToGoogleDrive,
} from '@/lib/cloud/googleDrive';

interface ShareMapModalProps {
  map: LearningMap;
  progressList: NodeProgress[];
  isOpen: boolean;
  onClose: () => void;
}

export function ShareMapModal({
  map,
  progressList,
  isOpen,
  onClose,
}: ShareMapModalProps) {
  const { t } = useTranslation();

  // 方案 B（網址直接分享）狀態
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [directShareUrl, setDirectShareUrl] = useState('');
  const [includesLessons, setIncludesLessons] = useState(false);
  const [lessonsCount, setLessonsCount] = useState(0);
  const [sizeKb, setSizeKb] = useState('0');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // 方案 A（Google Drive 雲端分享）狀態
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [drivePublishing, setDrivePublishing] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveResult, setDriveResult] = useState<{
    fileId: string;
    shareUrl: string;
    driveWebUrl: string;
  } | null>(null);
  const [copiedDriveUrl, setCopiedDriveUrl] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setUrlLoading(true);
    setUrlError(null);
    setDriveError(null);
    setDriveResult(null);
    setHasDriveToken(Boolean(getGoogleDriveToken().trim()));

    async function prepareUrlShare() {
      try {
        const lessons: Lesson[] = await lessonsRepo.getByMapId(map.id);
        if (!isMounted) return;
        setLessonsCount(lessons.length);

        const encodedRes = await encodeSharePayload(map, progressList, lessons);
        if (!isMounted) return;

        const baseHref =
          typeof window !== 'undefined'
            ? window.location.href
            : 'https://lin-yu-kuan.github.io/mapCraft/';
        const fullUrl = buildShareUrl(baseHref, { data: encodedRes.encoded });

        setDirectShareUrl(fullUrl);
        setIncludesLessons(encodedRes.includesLessons);
        setSizeKb(Math.max(0.5, encodedRes.byteLength / 1024).toFixed(1));
      } catch (err) {
        if (!isMounted) return;
        setUrlError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) {
          setUrlLoading(false);
        }
      }
    }

    void prepareUrlShare();

    return () => {
      isMounted = false;
    };
  }, [isOpen, map, progressList]);

  if (!isOpen) return null;

  const handleCopyDirectUrl = async () => {
    if (!directShareUrl) return;
    try {
      await navigator.clipboard.writeText(directShareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // fallback
    }
  };

  const handlePublishToDrive = async () => {
    setDrivePublishing(true);
    setDriveError(null);
    try {
      const res = await publishMapToGoogleDrive(map.id);
      setDriveResult(res);
      try {
        await navigator.clipboard.writeText(res.shareUrl);
        setCopiedDriveUrl(true);
        setTimeout(() => setCopiedDriveUrl(false), 3000);
      } catch {
        // ignore clipboard error
      }
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : String(err));
    } finally {
      setDrivePublishing(false);
    }
  };

  const handleCopyDriveUrl = async () => {
    if (!driveResult?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(driveResult.shareUrl);
      setCopiedDriveUrl(true);
      setTimeout(() => setCopiedDriveUrl(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 頂部標題 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('share.modalTitle', { title: map.title })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('share.modalSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 區塊 1：方案 B 網址直接分享 */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Link2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('share.tabUrlTitle')}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('share.tabUrlDesc')}
          </p>

          {urlLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>{t('common.loading')}</span>
            </div>
          ) : urlError ? (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{urlError}</span>
            </div>
          ) : (
            <>
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                {includesLessons || lessonsCount === 0
                  ? t('share.urlIncludesLessons', {
                      count: lessonsCount,
                      kb: sizeKb,
                    })
                  : t('share.urlSkeletonOnly', { kb: sizeKb })}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directShareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                />
                <button
                  type="button"
                  onClick={handleCopyDirectUrl}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{t('share.copiedBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{t('share.copyUrlBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 區塊 2：方案 A Google Drive 雲端分享 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Cloud className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>{t('share.tabDriveTitle')}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('share.tabDriveDesc')}
          </p>

          {!hasDriveToken ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <span>{t('share.needDriveConfig')}</span>
              <Link
                to="/settings"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{t('nav.settings')}</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {driveError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{driveError}</span>
                </div>
              )}

              {!driveResult ? (
                <button
                  type="button"
                  disabled={drivePublishing}
                  onClick={handlePublishToDrive}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 transition-colors"
                >
                  {drivePublishing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{t('share.publishingDrive')}</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-3.5 w-3.5" />
                      <span>{t('share.publishDriveBtn')}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-sky-700 dark:text-sky-300">
                    <span>{t('share.driveShareReady')}</span>
                    <a
                      href={driveResult.driveWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <span>{t('share.openDriveRaw')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={driveResult.shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={handleCopyDriveUrl}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
                    >
                      {copiedDriveUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('share.copiedBtn')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{t('share.copyUrlBtn')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default ShareMapModal;

