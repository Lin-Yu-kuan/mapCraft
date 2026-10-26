import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Clock,
  RotateCcw,
  Copy,
  Check,
  StopCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

import type { LearningMap, NodeStatus } from '@/domain/types';
import { SafeMarkdown } from '@/shared/components/SafeMarkdown';
import { useLesson } from './useLesson';

interface LessonDrawerProps {
  map: LearningMap;
  nodeId: string | null;
  status?: NodeStatus;
  onClose: () => void;
  onUpdateStatus?: (nodeId: string, nextStatus: NodeStatus) => void;
}

export function LessonDrawer({
  map,
  nodeId,
  status = 'todo',
  onClose,
  onUpdateStatus,
}: LessonDrawerProps) {
  const { t } = useTranslation();
  const {
    lesson,
    currentNode,
    pathLabels,
    isLoading,
    isGenerating,
    error,
    fetchLesson,
    cancelGeneration,
  } = useLesson(map, nodeId);

  // 測驗選擇狀態
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [hasCopiedNote, setHasCopiedNote] = useState(false);

  if (!nodeId || !currentNode) return null;

  // 匯出為 Markdown 筆記並複製
  const handleCopyNote = async () => {
    if (!lesson) return;
    const { content } = lesson;

    const mdLines = [
      `# ${currentNode.label}`,
      `> 所在路徑：${pathLabels}`,
      `> 難度：${currentNode.difficulty} ｜ 一句話摘要：${currentNode.summary}`,
      '',
      `## 1. 這是什麼`,
      content.concept,
      '',
      `## 2. 為什麼重要`,
      content.why,
      '',
    ];

    if (content.example) {
      mdLines.push(`## 3. 實戰範例`);
      mdLines.push(`- 情境：${content.example.scenario}`);
      if (content.example.code) {
        mdLines.push(`\`\`\`${content.example.language || ''}`);
        mdLines.push(content.example.code);
        mdLines.push(`\`\`\``);
      }
      mdLines.push(`- 重點解析：${content.example.explain}`);
      mdLines.push('');
    }

    if (content.pitfalls.length > 0) {
      mdLines.push(`## 4. 常見誤解`);
      content.pitfalls.forEach((p) => mdLines.push(`- ${p}`));
      mdLines.push('');
    }

    if (content.keyPoints.length > 0) {
      mdLines.push(`## 5. 重點回顧`);
      content.keyPoints.forEach((k) => mdLines.push(`- ${k}`));
      mdLines.push('');
    }

    mdLines.push(`---`);
    mdLines.push(`> AI 生成 · ${lesson.modelId} · ${new Date(lesson.createdAt).toLocaleString()} · 請自行查證`);

    try {
      await navigator.clipboard.writeText(mdLines.join('\n'));
      setHasCopiedNote(true);
      setTimeout(() => setHasCopiedNote(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <aside
      role="complementary"
      aria-label={t('lesson.drawerTitle')}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-all duration-300 sm:w-[480px] dark:bg-slate-950 dark:border-l dark:border-slate-800"
    >
      {/* 頂部 Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
        <div className="min-w-0 pr-3">
          <p className="line-clamp-1 text-[11px] font-medium text-slate-400" title={pathLabels}>
            {pathLabels}
          </p>
          <h2 className="line-clamp-1 text-base font-bold text-slate-900 dark:text-white" title={currentNode.label}>
            {currentNode.label}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 內容主滾動區 */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* 載入中（生成中態） */}
        {isLoading && !lesson ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('lesson.generatingTitle')}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('lesson.generatingDesc')}
              </p>
            </div>
            {isGenerating && (
              <button
                type="button"
                onClick={cancelGeneration}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>{t('lesson.stopGenerating')}</span>
              </button>
            )}
          </div>
        ) : error ? (
          /* 錯誤態 */
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-left dark:border-rose-900/60 dark:bg-rose-950/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                  {t('common.error')}
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300">{error.messageForUser}</p>
                <button
                  type="button"
                  onClick={() => fetchLesson(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-500"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t('common.retry')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : lesson ? (
          /* 六大分區渲染（Success State） */
          <>
            {/* 1. 這是什麼 (Concept) */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <BookOpen className="h-4 w-4" />
                <span>{t('lesson.conceptTitle')}</span>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <SafeMarkdown content={lesson.content.concept} />
              </div>
            </section>

            {/* 2. 為什麼重要 (Why) */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <HelpCircle className="h-4 w-4" />
                <span>{t('lesson.whyTitle')}</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {lesson.content.why}
              </p>
            </section>

            {/* 3. 實戰範例 (Example) */}
            {lesson.content.example && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  <FileText className="h-4 w-4" />
                  <span>{t('lesson.exampleTitle')}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-2">
                    {lesson.content.example.scenario}
                  </p>
                  {lesson.content.example.code && (
                    <SafeMarkdown
                      content={`\`\`\`${lesson.content.example.language || ''}\n${lesson.content.example.code}\n\`\`\``}
                    />
                  )}
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {lesson.content.example.explain}
                  </p>
                </div>
              </section>
            )}

            {/* 4. 常見誤解 (Pitfalls) */}
            {lesson.content.pitfalls.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t('lesson.pitfallsTitle')}</span>
                </div>
                <div className="space-y-2">
                  {lesson.content.pitfalls.map((pitfall, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      <span className="font-mono text-rose-500 font-bold">#{idx + 1}</span>
                      <span className="leading-relaxed">{pitfall}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. 重點回顧 (KeyPoints) */}
            {lesson.content.keyPoints.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <Lightbulb className="h-4 w-4" />
                  <span>{t('lesson.keyPointsTitle')}</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {lesson.content.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 6. 隨堂測驗 (Quiz) */}
            {lesson.content.quiz && (
              <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-950/60 dark:bg-indigo-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    {t('lesson.quizTitle')}
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  {lesson.content.quiz.question}
                </h4>

                {/* 選項列表 */}
                <div className="space-y-2">
                  {lesson.content.quiz.options.map((opt, optIdx) => {
                    const isSelected = selectedQuizOption === optIdx;
                    const isAnswer = optIdx === lesson.content.quiz?.answerIndex;
                    const hasSubmitted = selectedQuizOption !== null;

                    let btnClass =
                      'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200';

                    if (hasSubmitted) {
                      if (isAnswer) {
                        btnClass =
                          'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
                      } else if (isSelected) {
                        btnClass =
                          'border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setSelectedQuizOption(optIdx)}
                        className={`w-full rounded-xl border p-2.5 text-left text-xs transition-colors flex items-center justify-between ${btnClass}`}
                      >
                        <span>{opt}</span>
                        {hasSubmitted && isAnswer && (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 解析回饋 */}
                {selectedQuizOption !== null && (
                  <div className="mt-2 rounded-xl border border-indigo-200 bg-white p-3 text-xs text-slate-700 dark:border-indigo-900 dark:bg-slate-900 dark:text-slate-300">
                    <p className="font-semibold text-indigo-700 dark:text-indigo-400 mb-1">
                      {selectedQuizOption === lesson.content.quiz.answerIndex
                        ? t('lesson.quizCorrect')
                        : t('lesson.quizIncorrect')}
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      {lesson.content.quiz.explanation}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* AI 標籤聲明 */}
            <div className="pt-2 text-center text-[10px] text-slate-400">
              {t('lesson.aiDisclaimer', {
                model: lesson.modelId,
                timestamp: new Date(lesson.createdAt).toLocaleTimeString(),
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* 底部固定操作列 */}
      {lesson && (
        <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 學習狀態切換按鈕 */}
            <div className="flex items-center gap-1.5">
              {status !== 'done' ? (
                <button
                  type="button"
                  onClick={() => onUpdateStatus?.(nodeId, 'done')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('lesson.markAsDone')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdateStatus?.(nodeId, 'todo')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('lesson.markAsTodo')}</span>
                </button>
              )}

              {status !== 'learning' && status !== 'done' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus?.(nodeId, 'learning')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t('lesson.markAsLearning')}</span>
                </button>
              )}
            </div>

            {/* 輔助操作：複製筆記與重新生成 */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyNote}
                aria-label={t('lesson.copyMarkdown')}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {hasCopiedNote ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500">{t('lesson.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('lesson.copyMarkdown')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fetchLesson(true)}
                aria-label={t('lesson.regenerate')}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t('lesson.regenerate')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
