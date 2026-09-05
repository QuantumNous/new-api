import * as React from 'react';
/* We need to import the shim because React 17 does not support the `useSyncExternalStore` API.
 * More info: https://github.com/mui/mui-x/issues/18303#issuecomment-2958392341 */
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { isReactVersionAtLeast } from '../reactVersion';
import { register, getInstance, Instance } from '../fastHooks';
import type { ReadonlyStore } from './Store';

/* Some tests fail in R18 with the raw useSyncExternalStore. It may be possible to make it work
 * but for now we only enable it for R19+. */
const canUseRawUseSyncExternalStore = isReactVersionAtLeast(19);
const useStoreImplementation = canUseRawUseSyncExternalStore ? useStoreFast : useStoreLegacy;

export function useStore<State, Value>(
  store: ReadonlyStore<State>,
  selector: (state: State) => Value,
): Value;
export function useStore<State, Value, A1>(
  store: ReadonlyStore<State>,
  selector: (state: State, a1: A1) => Value,
  a1: A1,
): Value;
export function useStore<State, Value, A1, A2>(
  store: ReadonlyStore<State>,
  selector: (state: State, a1: A1, a2: A2) => Value,
  a1: A1,
  a2: A2,
): Value;
export function useStore<State, Value, A1, A2, A3>(
  store: ReadonlyStore<State>,
  selector: (state: State, a1: A1, a2: A2, a3: A3) => Value,
  a1: A1,
  a2: A2,
  a3: A3,
): Value;
export function useStore(
  store: ReadonlyStore<unknown>,
  selector: Function,
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
): unknown {
  return useStoreImplementation(store, selector, a1, a2, a3);
}

function useStoreR19(
  store: ReadonlyStore<unknown>,
  selector: Function,
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
): unknown {
  const getSelection = React.useCallback(
    () => selector(store.getSnapshot(), a1, a2, a3),
    [store, selector, a1, a2, a3],
  );

  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

export type StoreInstance = Instance & {
  syncIndex: number;
  syncTick: number;
  syncHooks: {
    store: any;
    selector: Function;
    a1: unknown;
    a2: unknown;
    a3: unknown;
    value: unknown;
  }[];
  didChangeStore: boolean;
  subscribe: (onStoreChange: any) => () => void;
  getSnapshot: () => unknown;
};

register({
  before(instance: StoreInstance) {
    instance.syncIndex = 0;

    if (!instance.didInitialize) {
      instance.syncTick = 1;
      instance.syncHooks = [];
      instance.didChangeStore = true;
      instance.getSnapshot = () => {
        let didChange = false;
        for (let i = 0; i < instance.syncHooks.length; i += 1) {
          const hook = instance.syncHooks[i];
          const value = hook.selector(hook.store.state, hook.a1, hook.a2, hook.a3);
          if (!Object.is(hook.value, value)) {
            didChange = true;
            hook.value = value;
          }
        }
        if (didChange) {
          instance.syncTick += 1;
        }
        return instance.syncTick;
      };
    }
  },
  after(instance: StoreInstance) {
    if (instance.syncHooks.length > 0) {
      if (instance.didChangeStore) {
        instance.didChangeStore = false;
        instance.subscribe = (onStoreChange) => {
          const stores = new Set<ReadonlyStore<unknown>>();
          for (const hook of instance.syncHooks) {
            stores.add(hook.store);
          }
          const unsubscribes: Array<() => void> = [];
          for (const store of stores) {
            unsubscribes.push(store.subscribe(onStoreChange));
          }
          return () => {
            for (const unsubscribe of unsubscribes) {
              unsubscribe();
            }
          };
        };
      }
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useSyncExternalStore(instance.subscribe, instance.getSnapshot, instance.getSnapshot);
    }
  },
});

function useStoreFast(
  store: ReadonlyStore<unknown>,
  selector: Function,
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
): unknown {
  const instance = getInstance() as StoreInstance | undefined;
  if (!instance) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useStoreR19(store, selector, a1, a2, a3);
  }

  const index = instance.syncIndex;
  instance.syncIndex += 1;

  let hook;
  if (!instance.didInitialize) {
    hook = {
      store,
      selector,
      a1,
      a2,
      a3,
      value: selector(store.getSnapshot(), a1, a2, a3),
    };
    instance.syncHooks.push(hook);
  } else {
    hook = instance.syncHooks[index];
    if (
      hook.store !== store ||
      hook.selector !== selector ||
      !Object.is(hook.a1, a1) ||
      !Object.is(hook.a2, a2) ||
      !Object.is(hook.a3, a3)
    ) {
      if (hook.store !== store) {
        instance.didChangeStore = true;
      }
      hook.store = store;
      hook.selector = selector;
      hook.a1 = a1;
      hook.a2 = a2;
      hook.a3 = a3;
      hook.value = selector(store.getSnapshot(), a1, a2, a3);
    }
  }

  return hook.value;
}

function useStoreLegacy(
  store: ReadonlyStore<unknown>,
  selector: Function,
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
): unknown {
  return useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
    (state) => selector(state, a1, a2, a3),
  );
}
