import { createContext } from 'react';

export enum LanguageEnum {
  chinese = 'zh',
  english = 'en'
}

export const getStoredLanguage = (): LanguageEnum => {
  const defaultLanguage = LanguageEnum.chinese;
  return (window.localStorage.getItem('language') as LanguageEnum) ?? defaultLanguage;
};

export const storeLanguage = (language: LanguageEnum) => {
  window.localStorage.setItem('language', language);
};

export const LanguageContext = createContext({
  language: LanguageEnum.chinese,
  setLanguage: (language: LanguageEnum) => {}
});
