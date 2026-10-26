import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';

export function MapPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <MapPin className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('topbar.untitledMap')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Craft ID: {id}
        </p>
      </div>
    </div>
  );
}

export default MapPage;
