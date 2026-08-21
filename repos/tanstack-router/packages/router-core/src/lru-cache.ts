export type LRUCache<TKey, TValue> = {
  get: (key: TKey) => TValue | undefined
  set: (key: TKey, value: TValue) => void
  clear: () => void
}

export function createLRUCache<TKey, TValue>(
  max: number,
): LRUCache<TKey, TValue> {
  type Node = { prev?: Node; next?: Node; key: TKey; value: TValue }
  const cache = new Map<TKey, Node>()
  let oldest: Node | undefined
  let newest: Node | undefined

  const touch = (entry: Node) => {
    if (!entry.next) return
    if (!entry.prev) {
      entry.next.prev = undefined
      oldest = entry.next
      entry.next = undefined
      if (newest) {
        entry.prev = newest
        newest.next = entry
      }
    } else {
      entry.prev.next = entry.next
      entry.next.prev = entry.prev
      entry.next = undefined
      if (newest) {
        newest.next = entry
        entry.prev = newest
      }
    }
    newest = entry
  }

  return {
    get(key) {
      const entry = cache.get(key)
      if (!entry) return undefined
      touch(entry)
      return entry.value
    },
    set(key, value) {
      if (cache.size >= max && oldest) {
        const toDelete = oldest
        cache.delete(toDelete.key)
        if (toDelete.next) {
          oldest = toDelete.next
          toDelete.next.prev = undefined
        }
        if (toDelete === newest) {
          newest = undefined
        }
      }
      const existing = cache.get(key)
      if (existing) {
        existing.value = value
        touch(existing)
      } else {
        const entry: Node = { key, value, prev: newest }
        if (newest) newest.next = entry
        newest = entry
        if (!oldest) oldest = entry
        cache.set(key, entry)
      }
    },
    clear() {
      cache.clear()
      oldest = undefined
      newest = undefined
    },
  }
}
