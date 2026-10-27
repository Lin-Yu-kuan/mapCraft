import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Plus, Loader2, BookOpen, Lightbulb, AlertCircle } from 'lucide-react';
import type { LearningMap, MapNode, NodeMode, Difficulty } from '@/domain/types';
import { buildSubtreeRequest } from '@/domain/prompts/subtree.zh-TW';
import { createProvider } from '@/lib/llm/factory';
import { getProviderMeta } from '@/lib/llm/registry';
import { getStoredApiKey } from '@/lib/storage/settings';
import { settingsRepo } from '@/lib/db/repos/settings';
import { parseAndValidateJson } from '@/lib/llm/json';
import { normalizeError } from '@/lib/llm/errors';
import { z } from 'zod';
import { getNodePath } from '@/domain/tree';

interface AddSubtreeModalProps {
  map: LearningMap;
  targetNode: MapNode;
  isOpen: boolean;
  onClose: () => void;
  onSubtreeAdded: (newChildren: (Omit<MapNode, 'id'> & { id?: string })[]) => void;
}

const SubtreeResponseSchema = z.object({
  children: z.array(
    z.object({
      label: z.string().min(1).max(40),
      summary: z.string().min(3).max(200),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      children: z
        .array(
          z.object({
            label: z.string().min(1).max(40),
            summary: z.string().min(3).max(200),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
          })
        )
        .optional(),
    })
  ),
});

export function AddSubtreeModal({
  map,
  targetNode,
  isOpen,
  onClose,
  onSubtreeAdded,
}: AddSubtreeModalProps) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

  // AI 產生設定
  const [depth, setDepth] = useState<number>(1); // 1~5，預設 1
  const [breadth, setBreadth] = useState<number>(3); // 1~5，預設 3
  const [mode, setMode] = useState<NodeMode>('learning');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 手動輸入設定
  const [manualLabel, setManualLabel] = useState<string>('');
  const [manualSummary, setManualSummary] = useState<string>('');
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty>('beginner');
  const [manualMode, setManualMode] = useState<NodeMode>('learning');

  // 處理手動新增子節點
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLabel.trim()) return;

    const newChild: Omit<MapNode, 'id'> = {
      label: manualLabel.trim(),
      summary: manualSummary.trim() || `${manualLabel.trim()} 的核心概念與實踐`,
      difficulty: manualDifficulty,
      mode: manualMode,
    };

    onSubtreeAdded([newChild]);
    onClose();
  };

  // 處理 AI 自動生成子分支
  const handleAiGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const appSettings = await settingsRepo.getSettings();
      const providerId = appSettings.lastProviderId || map.providerId || 'openai';
      const meta = getProviderMeta(providerId);
      const apiKey = getStoredApiKey(providerId);

      if (!apiKey && providerId !== 'ollama' && providerId !== 'webgpu') {
        setError(t('map.missingKeySubtree'));
        setIsGenerating(false);
        return;
      }

      const defaultModel =
        meta?.recommendedModels.find((m) => m.role === 'map' || m.role === 'both')?.id ||
        meta?.recommendedModels[0]?.id ||
        'gpt-4o-mini';
      const modelToUse = appSettings.lastMapModelId || defaultModel;

      const provider = createProvider(
        {
          id: providerId,
          baseUrl: meta?.defaultBaseUrl || 'https://api.openai.com/v1',
          model: modelToUse,
        },
        apiKey
      );

      const pathLabels = getNodePath(map.root, targetNode.id)
        .map((n) => n.label)
        .join(' > ');

      const existingChildrenLabels = targetNode.children?.map((c) => c.label) || [];

      const req = buildSubtreeRequest(
        {
          mapTitle: map.title,
          pathLabels,
          currentNodeLabel: targetNode.label,
          currentNodeSummary: targetNode.summary,
          mode,
          depth,
          breadth,
          existingChildrenLabels,
          goal: map.options.goal,
        },
        0.5
      );

      const res = await provider.generate(req);
      const validated = parseAndValidateJson(res.text, SubtreeResponseSchema);

      if (!validated.children || validated.children.length === 0) {
        setError(t('map.emptyChildrenError'));
        setIsGenerating(false);
        return;
      }

      // 轉換為 MapNode 結構並帶上 mode
      const newChildren: (Omit<MapNode, 'id'> & { id?: string })[] = validated.children.map((c) => ({
        label: c.label,
        summary: c.summary,
        difficulty: c.difficulty,
        mode,
        children: c.children?.map((sub) => ({
          id: '',
          label: sub.label,
          summary: sub.summary,
          difficulty: sub.difficulty,
          mode,
        })),
      }));

      onSubtreeAdded(newChildren);
      onClose();
    } catch (err: unknown) {
      const norm = normalizeError(err, 'unknown');
      setError(norm.messageForUser);
    } finally {
      setIsGenerating(false);
    }
  }, [map, targetNode, mode, depth, breadth, onSubtreeAdded, onClose, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-text animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-subtree-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 id="add-subtree-title" className="text-base font-bold text-slate-900 dark:text-white">
              {t('map.addSubtreeTitle', { label: targetNode.label })}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t('map.addSubtreeSubtitle', { label: targetNode.label })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab 切換：AI 即時生成 vs 手動手打輸入 */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'ai'
                ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t('map.aiGenerateTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'manual'
                ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t('map.manualInputTab')}
          </button>
        </div>

        {/* 錯誤提醒 */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: AI 即時生成 */}
        {activeTab === 'ai' && (
          <div className="mt-4 space-y-4">
            {/* 模式切換：學習模式 vs 腦力激盪模式 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('map.branchMode')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('learning')}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                    mode === 'learning'
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold ring-1 ring-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                  <div>
                    <span className="block font-medium">{t('map.modeLearning')}</span>
                    <span className="text-[10px] text-slate-400">{t('map.modeLearningDesc')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('brainstorm')}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                    mode === 'brainstorm'
                      ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-semibold ring-1 ring-amber-500 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <div>
                    <span className="block font-medium">{t('map.modeBrainstorm')}</span>
                    <span className="text-[10px] text-slate-400">{t('map.modeBrainstormDesc')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 廣度與深度設定（滑桿與數值） */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t('map.branchDepth')}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {depth} {t('map.depthUnit')}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
                <span className="text-[10px] text-slate-400">{t('map.depthDefaultDesc')}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t('map.branchBreadth')}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {breadth} {t('map.breadthUnit')}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={breadth}
                  onChange={(e) => setBreadth(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
                <span className="text-[10px] text-slate-400">{t('map.breadthDefaultDesc')}</span>
              </div>
            </div>

            {/* 送出 AI 生成 */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleAiGenerate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-98"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('map.generatingSubtree')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{t('map.generateBranchesBtn', { count: breadth })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: 手動手打輸入子節點 */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="mt-4 space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('map.manualLabel')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder={t('map.manualLabelPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('map.manualSummary')}
              </label>
              <input
                type="text"
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                placeholder={t('map.manualSummaryPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('map.manualDifficulty')}
                </label>
                <select
                  value={manualDifficulty}
                  onChange={(e) => setManualDifficulty(e.target.value as Difficulty)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  <option value="beginner">{t('nodeCard.difficultyBeginner')}</option>
                  <option value="intermediate">{t('nodeCard.difficultyIntermediate')}</option>
                  <option value="advanced">{t('nodeCard.difficultyAdvanced')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('map.branchMode')}
                </label>
                <select
                  value={manualMode}
                  onChange={(e) => setManualMode(e.target.value as NodeMode)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  <option value="learning">{t('map.modeLearning')}</option>
                  <option value="brainstorm">{t('map.modeBrainstorm')}</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-all active:scale-98"
              >
                <Plus className="h-4 w-4" />
                <span>{t('map.confirmAdd')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
