import assert from 'node:assert/strict'
import { actionsUrlFromConfigApiUrl } from './remote-guest-actions.ts'

assert.equal(
  actionsUrlFromConfigApiUrl(
    'https://panel.example/api/object/demo/room/101/config',
  ),
  'https://panel.example/api/object/demo/room/101/actions',
)

assert.equal(
  actionsUrlFromConfigApiUrl(
    'https://panel.example/api/object/demo/room/101/config/',
  ),
  'https://panel.example/api/object/demo/room/101/actions',
)

assert.equal(
  actionsUrlFromConfigApiUrl('https://panel.example/api/object/demo/room/101'),
  'https://panel.example/api/object/demo/room/101/actions',
)

console.log('remote-guest-actions.test.ts: ok')
