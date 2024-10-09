import { FreshContext, Plugin } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";

export const freshReqResMapping = {
  getUrl: (req: { _req: Request }) => {
    return req._req.url;
  },
  getHeaders: (req: { _req: Request }) => {
    return Object.fromEntries([...req._req.headers.entries()]);
  },
  getHeader: (res: Response, key: string) => {
    return res.headers.get(key);
  },
  setHeader: (res: Response, key: string, value: string) => {
    res.headers.set(key, value);
  },
  getQuery: (req: { _req: Request }) => {
    return new URL(req._req.url).searchParams;
  },
  getCookies: (req: { _req: Request }) => {
    return getCookies(req._req.headers);
  },
  setContentType: (res: Response, type: string) => {
    res.headers.set("Content-Type", type);
  },
};

export type StateWithI18n = {
  i18n: { t: (key: string) => string };
};

export function i18nextPlugin(options: {
  // deno-lint-ignore no-explicit-any
  i18nHandle: (req: any, res: any, next: any) => any;
}): Plugin {
  return {
    name: "i18next_plugin",
    middlewares: [
      {
        middleware: {
          handler: async function i18nHandler(req: Request, ctx: FreshContext) {
            if (ctx.destination !== "route") {
              return ctx.next();
            }

            // Creating a fake response to collect headers
            const i18nRes = new Response();

            // Creating object with i18n functions
            const i18nFns = {
              _req: req,
            };

            // Handling i18n
            options.i18nHandle(i18nFns, i18nRes, () => {});

            // Adding i18n fns to state
            ctx.state.i18n = i18nFns;

            // Getting real response
            const res = await ctx.next().then(
              (res) =>
                new Response(res.body, {
                  status: res.status,
                  statusText: res.statusText,
                  headers: {
                    ...Object.fromEntries([...res.headers.entries()]),
                    ...Object.fromEntries([...i18nRes.headers.entries()]),
                  },
                })
            );

            return res;
          },
        },
        path: "/",
      },
    ],
  };
}
