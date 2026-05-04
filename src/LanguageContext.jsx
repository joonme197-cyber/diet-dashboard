import { createContext, useContext, useState } from 'react';
import { translations } from './i18n';

// REGIONS_DATA moved to Firestore (governorates collection) — kept as empty fallback
export const REGIONS_DATA = [];

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');

  const toggleLang = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const tObj = translations[lang] || translations.ar;
  const tFn = (key) => tObj[key] || translations.ar[key] || key;
  // Works as both t('key') function call AND t.key property access (for legacy code)
  const t = new Proxy(tFn, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return tObj[prop] || translations.ar[prop] || prop;
    }
  });

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, tObj, isAr: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
