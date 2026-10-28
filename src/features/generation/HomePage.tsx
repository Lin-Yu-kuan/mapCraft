import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  GraduationCap,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { Level, GenerationOptions } from '@/domain/types';
import { loadDemoCraft } from '@/lib/db';
import { addWebGPUProgressListener } from '@/lib/llm/webgpu';
import { useGenerateMap } from './useGenerateMap';
import { GenerationErrorPanel } from './GenerationErrorPanel';

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>('beginner');
  const [goal, setGoal] = useState('');
  const [timeBudgetHours, setTimeBudgetHours] = useState(10);

  // 進階參數
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxBreadth, setMaxBreadth] = useState(5);
  const [maxNodes, setMaxNodes] = useState(30);
  const [temperature, setTemperature] = useState(0.4);

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

  const {
    isGenerating,
    error,
    rawOutput,
    generateMap,
    cancel,
    retry,
    retryWithRelaxed,
    clearError,
  } = useGenerateMap();

  const sampleTopics = t('home.sampleTopics', {
    returnObjects: true,
  }) as string[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    const options: GenerationOptions = {
      level,
      goal: goal.trim() || undefined,
      timeBudgetHours,
      maxDepth,
      maxBreadth,
      maxNodes,
      temperature,
      language: 'zh-TW',
    };

    const created = await generateMap(topic.trim(), options);
    if (created) {
      navigate(`/map/${created.id}`);
    }
  };

  const handleRetrySuccess = (map: unknown) => {
    if (map && typeof map === 'object' && 'id' in map) {
      navigate(`/map/${(map as { id: string }).id}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl text-center space-y-7">
        {/* BYOK 頂部標籤 */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {t('common.byokBadge')}
        </div>

        {/* 英雄標題與簡介 */}
        <div className="space-y-2.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            {t('home.heroTitle')}
          </h1>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {t('home.heroSubtitle')}
          </p>
        </div>

        {/* 錯誤面板 */}
        {error && (
          <GenerationErrorPanel
            error={error}
            rawOutput={rawOutput}
            onRetry={async () => {
              const res = await retry();
              handleRetrySuccess(res);
            }}
            onRetryRelaxed={async () => {
              const res = await retryWithRelaxed();
              handleRetrySuccess(res);
            }}
            onClose={clearError}
          />
        )}

        {/* 生成進行中狀態卡 */}
        {isGenerating ? (
          <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center shadow-sm backdrop-blur-xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <div className="mt-4 space-y-1.5">
              <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-200">
                {t('generation.planning')}
              </h2>
              <p className="text-xs text-emerald-700 sm:text-sm dark:text-emerald-300">
                {t('generation.generatingWait')}
              </p>
            </div>

            {/* WebGPU 專屬模型下載進度 */}
            {webGpuProgress && (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-emerald-300 bg-white/90 p-3.5 text-left shadow-xs dark:border-emerald-800 dark:bg-slate-900/90 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span className="truncate pr-2">{webGpuProgress.text}</span>
                  <span>{webGpuProgress.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-400"
                    style={{ width: `${webGpuProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 骨架載入條 */}
            <div className="mx-auto mt-6 max-w-sm space-y-2.5">
              <div className="h-2.5 w-full rounded-full bg-emerald-200/70 overflow-hidden dark:bg-emerald-900/70">
                <div className="h-full w-2/3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span>{t('home.stepHierarchy')}</span>
                <span>{t('home.stepDependencies')}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setWebGpuProgress(null);
                  cancel();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition-all hover:bg-emerald-100/60 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
              >
                <XCircle className="h-4 w-4" />
                <span>{t('generation.cancelGeneration')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* 主題輸入與設定表單 */
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl space-y-4">
            {/* 主題輸入卡 */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('home.topicInputPlaceholder')}
                disabled={isGenerating}
                className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-5 pr-40 sm:pr-44 text-base text-slate-900 shadow-sm transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10"
              />
              <button
                type="submit"
                disabled={!topic.trim() || isGenerating}
                className="absolute right-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                <span>{t('home.startCraft')}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* 程度與時數選擇卡 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
              {/* 熟悉程度 */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{t('generation.levelLabel')}</span>
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="beginner">{t('generation.levelBeginner')}</option>
                  <option value="some">{t('generation.levelSome')}</option>
                  <option value="advanced">{t('generation.levelAdvanced')}</option>
                </select>
              </div>

              {/* 預估學習時數 */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{t('generation.timeBudgetLabel')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={timeBudgetHours}
                    onChange={(e) => setTimeBudgetHours(Number(e.target.value) || 10)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('generation.timeBudgetUnit')}
                  </span>
                </div>
              </div>
            </div>

            {/* 學習目標（自由文字選填） */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs dark:border-slate-800 dark:bg-slate-950">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-500" />
                <span>{t('generation.goalLabel')}</span>
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t('generation.goalPlaceholder')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>

            {/* 進階參數摺疊開關 */}
            <div className="text-left">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors dark:text-slate-400 dark:hover:text-emerald-400"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  {showAdvanced
                    ? t('generation.hideAdvancedOptions')
                    : t('generation.advancedOptions')}
                </span>
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {/* 進階參數面板 */}
              {showAdvanced && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="grid grid-cols-2 gap-3">
                    {/* 深度 */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>{t('generation.maxDepthLabel')}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {maxDepth} {t('home.unitLevels')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={5}
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(Number(e.target.value))}
                        className="w-full accent-emerald-600 dark:accent-emerald-400"
                      />
                    </div>

                    {/* 廣度 */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>{t('generation.maxBreadthLabel')}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {maxBreadth} {t('home.unitItems')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={8}
                        value={maxBreadth}
                        onChange={(e) => setMaxBreadth(Number(e.target.value))}
                        className="w-full accent-emerald-600 dark:accent-emerald-400"
                      />
                    </div>

                    {/* 總節點 */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>{t('generation.maxNodesLabel')}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {maxNodes} {t('home.unitNodes')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={60}
                        value={maxNodes}
                        onChange={(e) => setMaxNodes(Number(e.target.value))}
                        className="w-full accent-emerald-600 dark:accent-emerald-400"
                      />
                    </div>

                    {/* 創意度 */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>{t('generation.temperatureLabel')}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {temperature.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-full accent-emerald-600 dark:accent-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        {/* 範例主題 chips */}
        {!isGenerating && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              <span>{t('home.sampleTopicsTitle')}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.isArray(sampleTopics) &&
                sampleTopics.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setTopic(sample)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
                  >
                    {sample}
                  </button>
                ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  const demoId = await loadDemoCraft(true);
                  navigate(`/map/${demoId}`);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-500 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                <span>{t('home.quickDemo')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
