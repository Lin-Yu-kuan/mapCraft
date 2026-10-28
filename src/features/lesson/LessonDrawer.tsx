import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  RotateCcw,
  Copy,
  Check,
  StopCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  Sparkles,
  ArrowRight,
  Target,
  Rocket,
  Trash2,
} from 'lucide-react';

import type { LearningMap, NodeStatus, NodeMode } from '@/domain/types';
import { getNodeParent, getNodeSiblings } from '@/domain/tree';
import { lessonsRepo } from '@/lib/db/repos/lessons';
import { addWebGPUProgressListener } from '@/lib/llm/webgpu';
import { SafeMarkdown } from '@/shared/components/SafeMarkdown';
import { useLesson } from './useLesson';

interface LessonDrawerProps {
  map: LearningMap;
  nodeId: string | null;
  status?: NodeStatus;
  onClose: () => void;
  onUpdateStatus?: (nodeId: string, nextStatus: NodeStatus) => void;
  onSelectNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export function LessonDrawer({
  map,
  nodeId,
  status = 'todo',
  onClose,
  onUpdateStatus,
  onSelectNode,
  onDeleteNode,
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
    generateLesson,
    cancelGeneration,
  } = useLesson(map, nodeId);

  // 測驗選擇狀態
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [hasCopiedNote, setHasCopiedNote] = useState(false);

  // 軟性依賴提醒確認框
  const [showPrereqWarning, setShowPrereqWarning] = useState(false);
  const pendingGenerateRef = useRef<(() => void) | null>(null);

  // WebGPU 本機模型下載進度
  const [webGpuProgress, setWebGpuProgress] = useState<{ progress: number; text: string } | null>(null);

  useEffect(() => {
    const unsub = addWebGPUProgressListener((report) => {
      setWebGpuProgress({
        progress: Math.round(report.progress * 100),
        text: report.text,
      });
    });
    return unsub;
  }, []);

  // 抽屜寬度可拖曳調整（預設 480px，範圍 380px ~ 900px）
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mapcraft.drawer.width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 380 && parsed <= 900) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return 480;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clamped = Math.min(Math.max(newWidth, 380), Math.min(window.innerWidth * 0.85, 900));
      setDrawerWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('mapcraft.drawer.width', String(drawerWidth));
      } catch {
        // ignore
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, drawerWidth]);

  if (!nodeId || !currentNode) return null;

  // 匯出為 Markdown 筆記並複製
  const handleCopyNote = async () => {
    if (!lesson) return;

    if (lesson.brainstormContent) {
      const b = lesson.brainstormContent;
      const mdLines = [
        `# ${currentNode.label}（腦力激盪）`,
        `> 所在路徑：${pathLabels}`,
        `> 綱要：${currentNode.summary}`,
        '',
        `## 💡 核心創意`,
        b.coreIdea,
        '',
        `## 🎯 應用情境`,
        ...b.useCases.map((u) => `- ${u}`),
        '',
        `## ⚠️ 潛在挑戰`,
        ...b.challenges.map((c) => `- ${c}`),
        '',
        `## 🚀 下一步行動`,
        ...b.nextSteps.map((n) => `- ${n}`),
        '',
        `---`,
        `*AI 生成 · ${lesson.modelId} · 請自行查證*`,
      ];

      try {
        await navigator.clipboard.writeText(mdLines.join('\n'));
        setHasCopiedNote(true);
        setTimeout(() => setHasCopiedNote(false), 2000);
      } catch {
        // ignore
      }
      return;
    }

    const { content } = lesson;

    const mdLines = [
      `# ${currentNode.label}`,
      `> 所在路徑：${pathLabels}`,
      `> 難度：${currentNode.difficulty} ｜ 一句話摘要：${currentNode.summary}`,
      '',
    ];

    if (content.markdown) {
      mdLines.push(content.markdown);
      mdLines.push('');
    } else {
      if (content.concept) {
        mdLines.push(`## 1. 這是什麼`);
        mdLines.push(content.concept);
        mdLines.push('');
      }
      if (content.why) {
        mdLines.push(`## 2. 為什麼重要`);
        mdLines.push(content.why);
        mdLines.push('');
      }
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
      if (content.pitfalls && content.pitfalls.length > 0) {
        mdLines.push(`## 4. 常見誤解`);
        content.pitfalls.forEach((p) => mdLines.push(`- ${p}`));
        mdLines.push('');
      }
      if (content.keyPoints && content.keyPoints.length > 0) {
        mdLines.push(`## 5. 重點回顧`);
        content.keyPoints.forEach((k) => mdLines.push(`- ${k}`));
        mdLines.push('');
      }
    }

    mdLines.push(`---`);
    mdLines.push(`*AI 生成 · ${lesson.modelId} · 請自行查證*`);

    try {
      await navigator.clipboard.writeText(mdLines.join('\n'));
      setHasCopiedNote(true);
      setTimeout(() => setHasCopiedNote(false), 2000);
    } catch {
      // ignore
    }
  };

  // 點擊「生成內容」時，進行軟性前置依賴檢查
  const handleTriggerGenerate = async (mode: NodeMode = 'learning') => {
    // 檢查 1：父節點（若非根節點）是否已生成
    const parent = getNodeParent(map.root, nodeId);
    let hasUnfinishedPrereq = false;

    if (parent && parent.id !== '0') {
      const parentLesson = await lessonsRepo.get(map.id, parent.id);
      if (!parentLesson) {
        hasUnfinishedPrereq = true;
      }
    }

    // 檢查 2：同層前一個順位節點是否已生成
    if (!hasUnfinishedPrereq) {
      const { prevSibling } = getNodeSiblings(map.root, nodeId);
      if (prevSibling) {
        const prevLesson = await lessonsRepo.get(map.id, prevSibling.id);
        if (!prevLesson) {
          hasUnfinishedPrereq = true;
        }
      }
    }

    if (hasUnfinishedPrereq) {
      // 軟性提醒確認框
      pendingGenerateRef.current = () => {
        generateLesson(mode);
      };
      setShowPrereqWarning(true);
    } else {
      generateLesson(mode);
    }
  };

  const handleConfirmPrereqContinue = () => {
    setShowPrereqWarning(false);
    if (pendingGenerateRef.current) {
      pendingGenerateRef.current();
      pendingGenerateRef.current = null;
    }
  };

  const handleGoToPrereq = () => {
    setShowPrereqWarning(false);
    pendingGenerateRef.current = null;
    // 優先前往未生成的父節點，其次為前兄弟節點
    const parent = getNodeParent(map.root, nodeId);
    if (parent && parent.id !== '0') {
      onSelectNode?.(parent.id);
      return;
    }
    const { prevSibling } = getNodeSiblings(map.root, nodeId);
    if (prevSibling) {
      onSelectNode?.(prevSibling.id);
    }
  };

  return (
    <aside
      role="complementary"
      aria-label={t('lesson.drawerTitle')}
      style={{
        width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${drawerWidth}px` : undefined,
      }}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl select-text dark:bg-slate-950 dark:border-l dark:border-slate-800"
    >
      {/* 桌面端左側橫向拖曳邊界把手（Resize Handle） */}
      <div
        onMouseDown={startResizing}
        title={t('lesson.resizeHandleTitle')}
        className="hidden sm:block absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-600 transition-colors z-20 group"
      >
        <div className="absolute top-1/2 left-0.5 -translate-y-1/2 h-8 w-1 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100 dark:bg-slate-700" />
      </div>

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

        <div className="flex items-center gap-1">
          {nodeId !== '0' && (
            <button
              type="button"
              onClick={() => onDeleteNode?.(nodeId)}
              title={t('nodeCard.deleteAria')}
              aria-label={t('nodeCard.deleteAria')}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 軟性依賴提醒彈窗 */}
      {showPrereqWarning && (
        <div className="border-b border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/60">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <h4 className="font-semibold">{t('map.prerequisiteWarningTitle')}</h4>
              <p className="leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
                {t('map.prerequisiteWarningDesc')}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPrereqContinue}
                  className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-500"
                >
                  {t('map.continueGenerate')}
                </button>
                <button
                  type="button"
                  onClick={handleGoToPrereq}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
                >
                  {t('map.cancelGenerate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 內容主滾動區（已解除 select-none，支援選取反白複製） */}
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
            {/* WebGPU 模型下載進度 */}
            {webGpuProgress && (
              <div className="w-full max-w-xs space-y-1.5 rounded-xl border border-emerald-200 bg-white/90 p-3 text-left shadow-xs dark:border-emerald-800 dark:bg-slate-900/90">
                <div className="flex justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span className="truncate pr-2">{webGpuProgress.text}</span>
                  <span>{webGpuProgress.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-400"
                    style={{ width: `${webGpuProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
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
        ) : !lesson ? (
          /* 尚未生成內容態（手動按鈕觸發生成） */
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('lesson.notGeneratedTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('lesson.notGeneratedDesc')}
              </p>
              {currentNode.summary && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                    {t('lesson.nodeSummaryTitle')}
                  </span>
                  {currentNode.summary}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleTriggerGenerate('learning')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-all active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t('lesson.generateLesson')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerGenerate('brainstorm')}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100 transition-all active:scale-95 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60"
              >
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>{t('lesson.generateBrainstorm')}</span>
              </button>
            </div>
          </div>
        ) : lesson.brainstormContent ? (
          /* 💡 腦力激盪四大分區渲染（Brainstorming Mode） */
          <>
            {/* 1. 核心創意 */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                <span>{t('lesson.brainstormCoreIdeas')}</span>
              </div>
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-4 shadow-2xs dark:border-amber-900/60 dark:bg-amber-950/40">
                <SafeMarkdown content={lesson.brainstormContent.coreIdea} />
              </div>
            </section>

            {/* 2. 應用情境 */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <Target className="h-4 w-4" />
                <span>{t('lesson.brainstormUseCases')}</span>
              </div>
              <div className="space-y-2">
                {lesson.brainstormContent.useCases.map((useCase, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{useCase}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. 潛在挑戰 */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <span>{t('lesson.brainstormChallenges')}</span>
              </div>
              <div className="space-y-2">
                {lesson.brainstormContent.challenges.map((challenge, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    <span className="text-rose-500 font-bold">•</span>
                    <span className="leading-relaxed">{challenge}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. 下一步行動 */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                <Rocket className="h-4 w-4" />
                <span>{t('lesson.brainstormNextSteps')}</span>
              </div>
              <div className="space-y-2">
                {lesson.brainstormContent.nextSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-sky-950 shadow-2xs dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200"
                  >
                    <ArrowRight className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
                    <span className="leading-relaxed font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : lesson ? (
          /* 📚 學習模式渲染（支援 v2 引導式自由教學 + 向下相容 v1 分區） */
          <>
            {lesson.content.markdown ? (
              /* v2 引導式自由排版教學主體 */
              <section className="space-y-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
                  <SafeMarkdown content={lesson.content.markdown} />
                </div>
              </section>
            ) : (
              /* v1 向下相容舊版五段式分區 */
              <>
                {lesson.content.concept && (
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <BookOpen className="h-4 w-4" />
                      <span>{t('lesson.conceptTitle')}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <SafeMarkdown content={lesson.content.concept} />
                    </div>
                  </section>
                )}

                {lesson.content.why && (
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <HelpCircle className="h-4 w-4" />
                      <span>{t('lesson.whyTitle')}</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {lesson.content.why}
                    </p>
                  </section>
                )}

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

                {lesson.content.pitfalls && lesson.content.pitfalls.length > 0 && (
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

                {lesson.content.keyPoints && lesson.content.keyPoints.length > 0 && (
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
              </>
            )}

            {/* 隨堂測驗 (Quiz) — 每個節點固定保留 */}
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-all active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('lesson.markAsDone')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdateStatus?.(nodeId, 'todo')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('lesson.cancelDone')}</span>
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
