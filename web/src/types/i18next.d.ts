import en from '@/locales/locales/en.json'
import 'react-i18next'

declare module 'react-i18next' {
  // Use defaultNS and resources for strong typing of t()
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof en
    }
  }
}
