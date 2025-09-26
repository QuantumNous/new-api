import en from './locales/en.json'
import zh from './locales/zh.json'

export const resources = {
  en: { common: en },
  zh: { common: zh },
}

export type AppLanguage = keyof typeof resources
