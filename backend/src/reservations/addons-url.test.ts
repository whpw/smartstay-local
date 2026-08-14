import assert from 'node:assert/strict'
import { HOTRES_ADDONS_URL_TEMPLATE, renderAddonsUrl } from './addons-url.ts'

const url = renderAddonsUrl({
  oid: '2660',
  resId: '12345',
  resAuth: 'abc-auth',
})

assert.equal(
  HOTRES_ADDONS_URL_TEMPLATE,
  'https://booking.hotres.pl/v4_upselling?oid={{oid}}&id={{resId}}&auth={{resAuth}}',
)
assert.equal(
  url,
  'https://booking.hotres.pl/v4_upselling?oid=2660&id=12345&auth=abc-auth',
)
assert.equal(url.includes('oid=2660'), true)
assert.equal(url.includes('{{oid}}'), false)

console.log('addons-url.test.ts: ok')
