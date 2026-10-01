import { computed, type Signal, untracked } from '@angular/core'
import { type Table } from '@tanstack/table-core'

type TableSignal<T> = Table<T> & Signal<Table<T>>

export function proxifyTable<T>(
  tableSignal: Signal<Table<T>>
): Table<T> & Signal<Table<T>> {
  const internalState = tableSignal as TableSignal<T>

  return new Proxy(internalState, {
    apply() {
      return tableSignal()
    },
    get(target, property: keyof Table<T>): any {
      if (target[property]) {
        return target[property]
      }
      const table = untracked(tableSignal)
      /**
       * Attempt to convert all accessors into computed ones,
       * excluding handlers as they do not retain any reactive value
       */
      if (
        property.startsWith('get') &&
        !property.endsWith('Handler')
        // e.g. getCoreRowModel, getSelectedRowModel etc.
        // We need that after a signal change even `rowModel` may mark the view as dirty.
        // This allows to always get the latest `getContext` value while using flexRender
        // && !property.endsWith('Model')
      ) {
        const maybeFn = table[property] as Function | never
        if (typeof maybeFn === 'function') {
          Object.defineProperty(target, property, {
            value: toComputed(tableSignal, maybeFn),
            configurable: true,
            enumerable: true,
          })
          return target[property]
        }
      }
      // @ts-expect-error
      return (target[property] = table[property])
    },
    has(_, prop: keyof Table<T>) {
      return !!untracked(tableSignal)[prop]
    },
    ownKeys() {
      return Reflect.ownKeys(untracked(tableSignal))
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
  })
}

/**
 * Here we'll handle all type of accessors:
 * - 0 argument -> e.g. table.getCanNextPage())
 * - 0~1 arguments -> e.g. table.getIsSomeRowsPinned(position?)
 * - 1 required argument -> e.g. table.getColumn(columnId)
 * - 1+ argument -> e.g. table.getRow(id, searchAll?)
 *
 * Since we are not able to detect automatically the accessors parameters,
 * we'll wrap all accessors into a cached function wrapping a computed
 * that return it's value based on the given parameters
 */
function toComputed<T>(signal: Signal<Table<T>>, fn: Function) {
  const hasArgs = fn.length > 0
  if (!hasArgs) {
    return computed(() => {
      void signal()
      return fn()
    })
  }

  const computedCache: Record<string, Signal<unknown>> = {}

  return (...argsArray: any[]) => {
    const serializedArgs = serializeArgs(...argsArray)
    if (computedCache.hasOwnProperty(serializedArgs)) {
      return computedCache[serializedArgs]?.()
    }
    const computedSignal = computed(() => {
      void signal()
      return fn(...argsArray)
    })

    computedCache[serializedArgs] = computedSignal

    return computedSignal()
  }
}

function serializeArgs(...args: any[]) {
  return JSON.stringify(args)
}
