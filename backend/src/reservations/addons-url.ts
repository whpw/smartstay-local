import Mustache from 'mustache'

export const HOTRES_ADDONS_URL_TEMPLATE =
  'https://booking.hotres.pl/v4_upselling?oid={{oid}}&id={{resId}}&auth={{resAuth}}'

export function renderAddonsUrl(params: {
  oid: string
  resId: string
  resAuth: string
}) {
  return Mustache.render(HOTRES_ADDONS_URL_TEMPLATE, params)
}
