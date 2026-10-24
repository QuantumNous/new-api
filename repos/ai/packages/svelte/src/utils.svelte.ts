import { getContext, hasContext, setContext, untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export function createContext<T>(name: string) {
  const key = Symbol(name);
  return {
    hasContext: () => {
      // At the time of writing there's no way to determine if we're
      // currently initializing a component without a try-catch
      try {
        return hasContext(key);
      } catch (e) {
        if (
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof e.message === 'string' &&
          e.message?.includes('lifecycle_outside_component')
        ) {
          return false;
        }

        throw e;
      }
    },
    getContext: () => getContext<T>(key),
    setContext: (value: T) => setContext(key, value),
  };
}

export function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

export class KeyedStore<T> extends SvelteMap<string, T> {
  #itemConstructor: new () => T;

  constructor(
    itemConstructor: new () => T,
    value?: Iterable<readonly [string, T]> | null | undefined,
  ) {
    super(value);
    this.#itemConstructor = itemConstructor;
  }

  get(key: string): T {
    const test =
      super.get(key) ??
      // Untrack here because this is technically a state mutation, meaning
      // deriveds downstream would fail. Because this is idempotent (even
      // though it's not pure), it's safe.
      untrack(() => this.set(key, new this.#itemConstructor())).get(key)!;

    return test;
  }
}
