import { freshReqResMapping } from '@/utils/i18next-plugin.ts'
import i18next from 'i18next'
import i18nextMiddleware from 'i18next_http_middleware'

i18next
  .use({
    type: 'backend',
    read: function (
      language: string,
      namespace: string,
      callback: (err: unknown, data?: unknown) => void,
    ) {
      Deno.readTextFile(`./locales/${language}/${namespace}.json`).then(
        (locales) => {
          callback(null, JSON.parse(locales))
        },
      ).catch(callback)
    },
  })
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    debug: false,
    initImmediate: false,
    fallbackLng: 'en',
    preload: ['pl', 'en'],
    detection: {
      ...freshReqResMapping,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })

export const i18nHandle = i18nextMiddleware.handle(i18next)
