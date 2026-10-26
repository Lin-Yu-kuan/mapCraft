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

// 預設語言與 html lang 同步
const initialLng = 'zh-TW';
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
});

export default i18n;
