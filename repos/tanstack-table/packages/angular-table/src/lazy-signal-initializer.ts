import { untracked } from '@angular/core'

/**
 * Implementation from @tanstack/angular-query
 * {@link https://github.com/TanStack/query/blob/main/packages/angular-query-experimental/src/util/lazy-init/lazy-init.ts}
 */
export function lazyInit<T extends object>(initializer: () => T): T {
  let object: T | null = null

  const initializeObject = () => {
    if (!object) {
      object = untracked(() => initializer())
    }
  }

  queueMicrotask(() => initializeObject())

  const table = () => {}

  return new Proxy<T>(table as T, {
    apply(target: T, thisArg: any, argArray: any[]): any {
      initializeObject()
      if (typeof object === 'function') {
        return Reflect.apply(object, thisArg, argArray)
      }
      return Reflect.apply(target as any, thisArg, argArray)
    },
    get(_, prop, receiver) {
      initializeObject()
      return Reflect.get(object as T, prop, receiver)
    },
    has(_, prop) {
      initializeObject()
      return Reflect.has(object as T, prop)
    },
    ownKeys() {
      initializeObject()
      return Reflect.ownKeys(object as T)
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
  })
}
