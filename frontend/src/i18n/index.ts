import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enTranslations from './locales/en/translation.json'
import plTranslations from './locales/pl/translation.json'

// import Backend from 'i18next-http-backend'
// don't want to use this?
// have a look at the Quick start guide
// for passing in lng and translations on init

export const defaultNS = 'translation'

const i18nCookieName = 'i18nextLng'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // resources,
    defaultNS,
    resources: {
      pl: {
        translation: plTranslations,
      },
      en: {
        translation: enTranslations,
      },
    },
    fallbackLng: 'pl',
    supportedLngs: ['pl', 'en'],

    detection: {
      order: ['cookie'],
      lookupCookie: i18nCookieName,
      caches: ['cookie'],
      cookieMinutes: 60 * 24 * 365,
    },
    interpolation: { escapeValue: false },
  })

export default i18n
