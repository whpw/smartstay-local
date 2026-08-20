import Mustache from 'mustache'

export function renderAddonsUrl(
  template: string | undefined,
  params: {
    number_str?: string
    resId: string
    oid?: string
    resAuth?: string
  },
) {
  return Mustache.render(template || '', params)
}
