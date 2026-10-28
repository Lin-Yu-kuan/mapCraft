import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UsePwaInstallResult {
  /** 是否可安裝（Chrome/Edge 攔截到安裝事件，或是 Mac/iOS 尚未安裝） */
  canInstall: boolean;
  /** 是否已經在 PWA 獨立視窗中運行 */
  isStandalone: boolean;
  /** 是否為 Apple 裝置（Mac / iPhone / iPad 的 Safari） */
  isAppleDevice: boolean;
  /** 觸發原生安裝視窗 */
  promptInstall: () => Promise<boolean>;
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isAppleDevice, setIsAppleDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 檢查是否已在 PWA 獨立視窗（Standalone）中執行
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(Boolean(isStandaloneMode));

    // 檢查是否為 Apple 裝置（Mac / iPhone / iPad 的 Safari）
    const isApple =
      /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      !('chrome' in window);
    setIsAppleDevice(isApple);

    // 監聽 Chrome / Edge 的原生安裝提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) || (!isStandalone && isAppleDevice),
    isStandalone,
    isAppleDevice,
    promptInstall,
  };
}

