import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Code2,
  Copy,
  Check,
  KeyRound,
  X,
} from 'lucide-react';
import type { NormalizedError } from '@/lib/llm/types';

interface GenerationErrorPanelProps {
  error: NormalizedError;
  rawOutput: string | null;
  onRetry: () => void;
  onRetryRelaxed: () => void;
  onClose: () => void;
}

export function GenerationErrorPanel({
  error,
  rawOutput,
  onRetry,
  onRetryRelaxed,
  onClose,
}: GenerationErrorPanelProps) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAuthError = error.code === 'UNAUTHORIZED';

  const handleCopyRaw = async () => {
    if (!rawOutput) return;
    try {
      await navigator.clipboard.writeText(rawOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 忽略複製失敗
    }
  };

  return (
    <div
      role="alert"
      className="relative w-full rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-left shadow-sm backdrop-blur-xs transition-all dark:border-rose-900/60 dark:bg-rose-950/40"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label={t('common.close')}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-start gap-3.5 pr-8">
        <div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            {isAuthError ? t('generation.missingKeyTitle') : t('common.error')}
          </h3>
          <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-300">
            {isAuthError ? t('generation.missingKeyDesc') : error.messageForUser}
          </p>

          {/* 操作按鈕群 */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {isAuthError ? (
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-all hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{t('generation.goToSettings')}</span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-all hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t('common.retry')}</span>
                </button>

                <button
                  type="button"
                  onClick={onRetryRelaxed}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-xs transition-all hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{t('generation.retryRelaxed')}</span>
                </button>
              </>
            )}

            {rawOutput && (
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>{t('generation.viewRawOutput')}</span>
              </button>
            )}
          </div>

          {/* 原始輸出可複製抽屜 */}
          {showRaw && rawOutput && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-200 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-mono text-slate-400">{t('generation.rawOutputTitle')}</span>
                <button
                  type="button"
                  onClick={handleCopyRaw}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{t('generation.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{t('generation.copyRawOutput')}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-48 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap break-all text-slate-300">
                {rawOutput}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
