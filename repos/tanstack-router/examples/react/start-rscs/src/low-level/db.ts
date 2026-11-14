import Dexie from 'dexie'

import type { EntityTable } from 'dexie'

// Dexie database for RSC payload caching
export interface RscCacheEntry {
  id: string
  payload: string
  createdAt: number
}

export const db = new Dexie('RscCache') as Dexie & {
  cache: EntityTable<RscCacheEntry, 'id'>
}

db.version(1).stores({
  cache: 'id, createdAt',
})
