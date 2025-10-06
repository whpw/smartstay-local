import 'i18next'
import type { defaultNS } from './index'
import type translation from './locales/pl/translation.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: {
      translation: typeof translation
    }
  }
}
