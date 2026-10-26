import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowRight } from 'lucide-react';

export function HomePage() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');

  const sampleTopics = t('home.sampleTopics', {
    returnObjects: true,
  }) as string[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    // 後續由 generation 模組接管
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl text-center space-y-8">
        {/* 標籤 */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {t('common.byokBadge')}
        </div>

        {/* 標題與引言 */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            {t('home.heroTitle')}
          </h1>
          <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
            {t('home.heroSubtitle')}
          </p>
        </div>

        {/* 主題輸入卡 */}
        <form onSubmit={handleSubmit} className="relative mx-auto w-full max-w-xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('home.topicInputPlaceholder')}
              className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-5 pr-32 text-base text-slate-900 shadow-sm transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10"
            />
            <button
              type="submit"
              disabled={!topic.trim()}
              className="absolute right-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <span>{t('home.startCraft')}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* 範例主題 chips */}
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
        </div>
      </div>
    </div>
  );
}

export default HomePage;
