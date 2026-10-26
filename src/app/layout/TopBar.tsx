import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Settings, FolderKanban, Languages, Sun, Moon } from 'lucide-react';
import { useTheme } from '../themeContext';

interface TopBarProps {
  mapTitle?: string;
  progressPercent?: number;
}

export function TopBar({ mapTitle, progressPercent }: TopBarProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { actualTheme, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(nextLng);
  };

  const isSettingsActive = location.pathname === '/settings';
  const isLibraryActive = location.pathname === '/library';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* 左側：品牌 Logo 與地圖標題 */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight text-slate-900 dark:text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg">
              {t('common.appName')}
              <span className="ml-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                {t('common.appSubtitle')}
              </span>
            </span>
          </Link>

          {mapTitle && (
            <div className="hidden items-center gap-2 border-l border-slate-200 pl-4 sm:flex dark:border-slate-800">
              <span className="max-w-[200px] truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                {mapTitle}
              </span>
              {typeof progressPercent === 'number' && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  {progressPercent}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* 右側：導覽與工具 */}
        <div className="flex items-center gap-2">
          <Link
            to="/library"
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
              isLibraryActive
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
            aria-label={t('topbar.libraryAria')}
          >
            <FolderKanban className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('nav.library')}</span>
          </Link>

          <Link
            to="/settings"
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
              isSettingsActive
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
            aria-label={t('topbar.settingsAria')}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('nav.settings')}</span>
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Toggle language"
            title={i18n.language.startsWith('zh') ? 'Switch to English' : '切換為繁體中文'}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t('topbar.themeToggleAria')}
            title={actualTheme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
          >
            {actualTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
