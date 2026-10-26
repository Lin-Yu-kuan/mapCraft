import { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { orphanCleanup } from '@/lib/db';

import { ThemeProvider } from './theme';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // 啟動時自動清理無效 map 的進度與教材快取（SPEC §4.3 & AC-05）
    orphanCleanup().catch((err) => {
      if (import.meta.env.DEV) {
        console.error('orphanCleanup failed:', err);
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

export default Providers;
