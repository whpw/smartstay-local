import assert from 'node:assert/strict'
import { renderAddonsUrl } from './addons-url.ts'

const template = 'https://booking.hotres.pl/upsell/{{number_str}}/{{resId}}'

{
  const url = renderAddonsUrl(template, {
    number_str: 'abc-token',
    resId: '12345',
  })
  assert.equal(url, 'https://booking.hotres.pl/upsell/abc-token/12345')
}

{
  const url = renderAddonsUrl(
    'https://booking.hotres.pl/v4_upselling?oid={{oid}}&id={{resId}}&auth={{resAuth}}',
    {
      oid: '2660',
      resId: '12345',
      resAuth: 'legacy-auth',
    },
  )
  assert.equal(
    url,
    'https://booking.hotres.pl/v4_upselling?oid=2660&id=12345&auth=legacy-auth',
  )
}

{
  const url = renderAddonsUrl(undefined, { resId: '1', number_str: 'x' })
  assert.equal(url, '')
}

console.log('addons-url.test.ts: ok')
