import { FlatCache } from 'flat-cache'
import superjson from 'superjson'

export let _db: FlatCache | null = null

export const db = (): FlatCache => {
  if (!_db) {
    _db = new FlatCache({
      cacheDir: '../../appdata/cache',
      persistInterval: 1000,
      serialize: superjson.stringify,
      deserialize: superjson.parse,
    })
    _db.load()
  }
  return _db
}

export const disposeDb = () => {
  if (!_db) {
    return
  }
  _db.save()
  _db.stopAutoPersist()
  _db = null
}

export const toKey = (...args: Array<string | number>) => args.join('/')
