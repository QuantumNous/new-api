export type IdentifiedItem = {
  id: number
}

export function getNextItemId<T extends IdentifiedItem>(items: T[]) {
  return Math.max(...items.map((item) => item.id), 0) + 1
}

export function upsertItem<T extends IdentifiedItem>(items: T[], item: T) {
  const exists = items.some((current) => current.id === item.id)
  if (!exists) {
    return [...items, item]
  }
  return items.map((current) => (current.id === item.id ? item : current))
}

export function removeItemsById<T extends IdentifiedItem>(
  items: T[],
  ids: number[]
) {
  const idSet = new Set(ids)
  return items.filter((item) => !idSet.has(item.id))
}
