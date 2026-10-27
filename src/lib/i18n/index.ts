import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './zh-TW.json';
import en from './en.json';

export const defaultNS = 'common';
export const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  en: {
    translation: en,
  },
} as const;

// 預設語言與 html lang 同步，優先從 localStorage 讀取
const savedLng = typeof window !== 'undefined' ? localStorage.getItem('mapcraft.language') : null;
const initialLng = savedLng || 'zh-TW';
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLng;
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'zh-TW',
  interpolation: {
    escapeValue: false, // React already escapes XSS
  },
});

i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mapcraft.language', lng);
    } catch {
      // ignore
    }
  }
});

export default i18n;
