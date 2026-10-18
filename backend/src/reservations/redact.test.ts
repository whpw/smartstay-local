import assert from 'node:assert/strict'
import { redactHotresError } from './redact.ts'

{
  const error = new Error(
    'Request failed with status code 500: GET https://panel.hotres.pl/api_reservationdetails?reservations_number=123&auth=AUTH&apikey=KEY',
  )
  const text = redactHotresError(error)
  assert.ok(!text.includes('123'))
  assert.ok(!text.includes('AUTH'))
  assert.ok(!text.includes('KEY'))
  assert.ok(text.includes('apikey=[redacted]'))
}

assert.equal(redactHotresError('plain'), 'plain')

console.log('redact.test.ts: ok')
