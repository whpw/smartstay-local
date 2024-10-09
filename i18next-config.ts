import { freshReqResMapping } from "@/utils/i18next-plugin.ts";
import i18next from "i18next";
import Backend from "i18next_fs_backend";
import i18nextMiddleware from "i18next_http_middleware";

i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    debug: false,
    initImmediate: false,
    fallbackLng: "en",
    preload: ["pl", "en"],
    detection: {
      ...freshReqResMapping,
    },
    backend: {
      loadPath: "locales/{{lng}}/{{ns}}.json",
    },
  });

export const i18nHandle = i18nextMiddleware.handle(i18next);
