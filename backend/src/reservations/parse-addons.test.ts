import assert from 'node:assert/strict'
import { parseHotresAddons } from './parse-addons.ts'

{
  const addons = parseHotresAddons([
    {
      title: 'jedna sesja jacuzzi [kod: jacuzzi-per-session]',
      quantity: '2',
    },
    {
      title: 'Sauna na cały pobyt [kod: sauna-per-stay]',
      quantity: '1',
    },
    {
      title: 'Breakfast',
      quantity: '1',
    },
  ])
  assert.deepEqual(addons, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 2 },
    { type: 'sauna', mode: 'per-stay', quantity: 1 },
  ])
}

{
  const addons = parseHotresAddons([
    { title: 'Jacuzzi [kod: jacuzzi-per-session]', quantity: '1' },
    { title: 'Jacuzzi extra [kod: jacuzzi-per-session]', quantity: '2' },
  ])
  assert.deepEqual(addons, [
    { type: 'jacuzzi', mode: 'per-session', quantity: 3 },
  ])
}

{
  assert.deepEqual(parseHotresAddons([]), [])
}

console.log('parse-addons.test.ts: ok')
