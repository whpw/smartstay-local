import { FlatCache } from 'flat-cache'

export let _db: FlatCache | null = null

export const db = (): FlatCache => {
  if (!_db) {
    _db = new FlatCache({
      cacheDir: '../../appdata/cache',
      persistInterval: 1000,
    })
  }
  return _db
}

export const toKey = (...args: Array<string | number>) => args.join('/')
