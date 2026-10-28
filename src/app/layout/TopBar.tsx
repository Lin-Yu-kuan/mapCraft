import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Settings, FolderKanban, Languages, Sun, Moon, Download, Info, X } from 'lucide-react';
import { useTheme } from '../themeContext';
import { usePwaInstall } from '@/shared';

interface TopBarProps {
  mapTitle?: string;
  progressPercent?: number;
}

export function TopBar({ mapTitle, progressPercent }: TopBarProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { actualTheme, toggleTheme } = useTheme();
  const { canInstall, isStandalone, isAppleDevice, promptInstall } = usePwaInstall();
  const [showMacGuide, setShowMacGuide] = useState(false);

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(nextLng);
  };

  const handleInstallClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else {
      setShowMacGuide(true);
    }
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
          {/* PWA 安裝按鈕：僅在非 standalone 獨立視窗模式下顯示 */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
              aria-label={t('topbar.installAppAria')}
              title={t('topbar.installAppAria')}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">{t('topbar.installApp')}</span>
            </button>
          )}

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
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            aria-label="Toggle language"
            title={i18n.language.startsWith('zh') ? 'Switch to English' : '切換為繁體中文'}
          >
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{i18n.language.startsWith('zh') ? 'EN' : '繁中'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t('topbar.themeToggleAria')}
            title={actualTheme === 'dark' ? t('topbar.themeLightTitle') : t('topbar.themeDarkTitle')}
          >
            {actualTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mac / 手動安裝導引彈窗 */}
      {showMacGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Info className="h-5 w-5" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {isAppleDevice ? t('topbar.installSafariTitle') : t('topbar.installApp')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMacGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t('topbar.installSafariGuide')}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMacGuide(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default TopBar;
