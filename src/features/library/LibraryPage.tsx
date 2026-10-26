import { useTranslation } from 'react-i18next';
import { FolderKanban, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LibraryPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('nav.library')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('common.tagline')}
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.newCraft')}</span>
        </Link>
      </div>

      {/* 空狀態 */}
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <FolderKanban className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          {t('topbar.untitledMap')}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {t('home.heroSubtitle')}
        </p>
      </div>
    </div>
  );
}

export default LibraryPage;
