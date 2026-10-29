import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Share2,
  Plus,
  Loader2,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  X,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Cloud,
} from 'lucide-react';

import { decodeSharePayload, type SharePayload } from '@/domain/share';
import { BackupSchema } from '@/domain/schemas';
import { countLearningNodes, findNode } from '@/domain/tree';
import type { LearningMap, NodeStatus, Lesson } from '@/domain/types';
import {
  downloadDriveJsonFile,
  requestGoogleDriveOAuthToken,
  setGoogleDriveToken,
  verifyGoogleDriveToken,
  persistGoogleDriveUserSession,
} from '@/lib/cloud/googleDrive';
import { settingsRepo } from '@/lib/db';
import { saveSharedPayloadToLocal } from '@/lib/storage/backup';
import { SafeMarkdown } from '@/shared/components/SafeMarkdown';
import { MapCanvas } from './MapCanvas';

export function SharedMapPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dataParam = searchParams.get('data');
  const gdriveParam = searchParams.get('gdrive');

  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);

  useEffect(() => {
    void settingsRepo.getSettings().then((s) => {
      if (s.gdriveUserEmail) setRememberedEmail(s.gdriveUserEmail);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const { token, expiresIn } = await requestGoogleDriveOAuthToken(
        undefined,
        rememberedEmail || undefined
      );
      setGoogleDriveToken(token);
      const verify = await verifyGoogleDriveToken(token);
      if (verify.ok && verify.user) {
        await persistGoogleDriveUserSession(verify.user, expiresIn);
        if (verify.user.emailAddress) {
          setRememberedEmail(verify.user.emailAddress);
        }
      }
      setReloadCount((c) => c + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 選中節點預覽抽屜
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  useEffect(() => {
    setSelectedQuizOption(null);
  }, [selectedNodeId]);

  useEffect(() => {
    let isMounted = true;

    async function loadShared() {
      setIsLoading(true);
      setError(null);

      try {
        if (dataParam) {
          const decoded = await decodeSharePayload(dataParam);
          if (!isMounted) return;
          setPayload(decoded);
        } else if (gdriveParam) {
          const rawJson = await downloadDriveJsonFile(gdriveParam);
          if (!isMounted) return;
          const parsed = JSON.parse(rawJson);
          const validated = BackupSchema.parse(parsed);
          const firstMap = validated.maps[0] as unknown as LearningMap | undefined;
          if (!firstMap) {
            throw new Error('雲端分享檔案中不包含任何學習地圖。');
          }
          setPayload({
            v: 1,
            map: firstMap,
            progress: validated.progress as unknown as SharePayload['progress'],
            lessons: validated.lessons as unknown as SharePayload['lessons'],
          });
        } else {
          setPayload(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadShared();

    return () => {
      isMounted = false;
    };
  }, [dataParam, gdriveParam, reloadCount]);

  const progressMap = useMemo(() => {
    const record: Record<string, NodeStatus> = {};
    if (payload?.progress) {
      for (const p of payload.progress) {
        record[p.nodeId] = p.status;
      }
    }
    return record;
  }, [payload]);

  const totalNodes = useMemo(
    () => (payload?.map ? countLearningNodes(payload.map.root) : 0),
    [payload]
  );

  const selectedNode = useMemo(
    () =>
      payload?.map && selectedNodeId
        ? findNode(payload.map.root, selectedNodeId)
        : null,
    [payload, selectedNodeId]
  );

  const selectedLesson: Lesson | undefined = useMemo(
    () =>
      payload?.lessons && selectedNodeId
        ? payload.lessons.find((l) => l.nodeId === selectedNodeId)
        : undefined,
    [payload, selectedNodeId]
  );

  const handleSaveToLocal = async () => {
    if (!payload) return;
    setIsSaving(true);
    try {
      const savedMapId = await saveSharedPayloadToLocal(payload);
      navigate(`/map/${savedMapId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

  // 狀態 1：載入中
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {t('share.loadingShared')}
        </p>
      </div>
    );
  }

  // 狀態 2：錯誤
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
          {t('share.invalidShareTitle')}
        </h2>
        <p className="mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
          {t('share.invalidShareDesc')}
        </p>
        <p className="mt-2 max-w-md rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {gdriveParam && (
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={() => void handleGoogleSignIn()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
              <span>
                {rememberedEmail
                  ? `以 ${rememberedEmail} 快速重新授權`
                  : '登入 Google 以存取此地圖'}
              </span>
            </button>
          )}
          {gdriveParam && (
            <a
              href={`https://drive.google.com/file/d/${encodeURIComponent(gdriveParam)}/view?usp=sharing`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
            >
              <span>{t('share.openDriveRaw')}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('nav.library')}</span>
          </Link>
        </div>
      </div>
    );
  }

  // 狀態 3：空狀態
  if (!payload) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Share2 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
          {t('share.invalidShareTitle')}
        </h2>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          <span>{t('errors.backToHome')}</span>
        </Link>
      </div>
    );
  }

  // 狀態 4：成功渲染分享地圖預覽與儲存橫幅
  return (
    <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col">
      {/* 頂部預覽橫幅與「儲存至我的地圖庫」主按鈕 */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50/95 px-4 py-2.5 backdrop-blur-md dark:border-emerald-900/60 dark:bg-emerald-950/80">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
            {t('share.previewBannerBadge')}
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {payload.map.title}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {t('share.previewMeta', {
              nodes: totalNodes,
              lessons: payload.lessons?.length || 0,
            })}
          </span>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveToLocal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-all"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('share.savingToMyCrafts')}</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>{t('share.saveToMyCrafts')}</span>
            </>
          )}
        </button>
      </div>

      {/* 互動式心智圖畫布 */}
      <div className="relative flex-1 w-full h-full">
        <MapCanvas
          map={payload.map}
          progressMap={progressMap}
          selectedNodeId={selectedNodeId}
          orderMode={false}
          onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
        />

        {/* 右側節點預覽抽屜（若有隨附教材可直接閱讀） */}
        {selectedNode && (
          <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedNode.label}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selectedNode.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedLesson?.content.markdown ? (
                <>
                  <SafeMarkdown content={selectedLesson.content.markdown} />

                  {selectedLesson.content.quiz && (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <HelpCircle className="h-4 w-4 text-emerald-600" />
                        <span>{t('lesson.quizTitle')}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {selectedLesson.content.quiz.question}
                      </p>
                      <div className="space-y-2">
                        {selectedLesson.content.quiz.options.map((opt, idx) => {
                          const isSelected = selectedQuizOption === idx;
                          const isCorrect =
                            idx === selectedLesson.content.quiz?.answerIndex;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedQuizOption(idx)}
                              className={`w-full rounded-xl border p-2.5 text-left text-xs transition-all ${
                                isSelected
                                  ? isCorrect
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                                    : 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {selectedQuizOption !== null && (
                        <div className="rounded-xl bg-emerald-50/80 p-3 text-xs text-slate-700 dark:bg-emerald-950/40 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{t('lesson.explanation')}</span>
                          </div>
                          {selectedLesson.content.quiz.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-8 w-8 text-slate-400 mb-3" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    將此地圖「儲存至我的地圖庫」後，即可針對任意節點使用 AI 即時生成專屬引導式教材與隨堂測驗！
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveToLocal}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('share.saveToMyCrafts')}</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default SharedMapPage;

