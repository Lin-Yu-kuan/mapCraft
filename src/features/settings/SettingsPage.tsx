import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck } from 'lucide-react';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('settings.providerLabel')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                BYOK (Bring Your Own Key)
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{t('common.byokBadge')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
