// Lazy materialization for the lanes===1 fast path. Backed by a
// Float64Array (stride 2: start, size, …); VirtualItems are constructed on
// first indexed read and cached. Saves the per-item object allocation at
// large list counts where most items are never visible.

import type { VirtualItem } from './index'

type Key = number | string | bigint

export function createLazyMeasurementsView(
  count: number,
  flat: Float64Array,
  getItemKey: (i: number) => Key,
): Array<VirtualItem> {
  const cache: Array<VirtualItem | undefined> = new Array(count)
  return new Proxy(cache as any, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        // Cheap digit-prefix sniff before number coerce.
        const c = prop.charCodeAt(0)
        if (c >= 48 && c <= 57) {
          const i = +prop
          if (Number.isInteger(i) && i >= 0 && i < count) {
            let v = target[i]
            if (!v) {
              const s = flat[i * 2]!
              v = target[i] = {
                index: i,
                key: getItemKey(i),
                start: s,
                size: flat[i * 2 + 1]!,
                end: s + flat[i * 2 + 1]!,
                lane: 0,
              }
            }
            return v
          }
        }
        if (prop === 'length') return count
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as Array<VirtualItem>
}
