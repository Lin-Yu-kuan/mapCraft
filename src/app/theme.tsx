import { useEffect, useState, useCallback, ReactNode } from 'react';
import { settingsRepo } from '@/lib/db';
import { ThemeContext, type Theme } from './themeContext';

const THEME_STORAGE_KEY = 'mapcraft.theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    const initial = getStoredTheme();
    return initial === 'system' ? getSystemPreference() : initial;
  });

  const applyTheme = useCallback((targetTheme: Theme) => {
    const isDark =
      targetTheme === 'system'
        ? getSystemPreference() === 'dark'
        : targetTheme === 'dark';

    setActualTheme(isDark ? 'dark' : 'light');

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {
        // 忽略 localStorage 受限情況
      }
      applyTheme(newTheme);

      // 非同步持久化至 settingsRepo
      settingsRepo.saveSettings({ theme: newTheme }).catch(() => {
        // 忽略非同步儲存例外
      });
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  }, [actualTheme, setTheme]);

  // 監聽系統主題偏好變更
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // 初始化套用
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        actualTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
