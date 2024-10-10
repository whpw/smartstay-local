import { IS_BROWSER } from '$fresh/runtime.ts'
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

if (IS_BROWSER) {
    await i18next.use({
        type: 'backend',
        read: function (
            language: string,
            namespace: string,
            callback: (err: unknown, data?: unknown) => void,
        ) {
            fetch(`/locales/${language}/${namespace}.json`).then(
                (res) => res.json(),
            ).then((locales) => callback(null, locales)).catch(callback)
        },
    }).use(LanguageDetector).init({
        debug: false,
        initImmediate: false,
        fallbackLng: 'en',
        preload: ['pl', 'en'],
        detection: {
            order: [
                'navigator',
                'localStorage',
                'cookie',
            ],
            caches: ['cookie'],
            lookupCookie: 'i18next',
            lookupLocalStorage: 'i18nextLng',
        },
    })
}

export const i18n = i18next
