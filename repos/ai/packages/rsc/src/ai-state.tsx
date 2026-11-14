import * as jsondiffpatch from 'jsondiffpatch';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createResolvablePromise } from './util/create-resolvable-promise';
import { isFunction } from './util/is-function';
import type {
  AIProvider,
  InferAIState,
  InternalAIStateStorageOptions,
  MutableAIState,
  ValueOrUpdater,
} from './types';

// It is possible that multiple AI requests get in concurrently, for different
// AI instances. So ALS is necessary here for a simpler API.
const asyncAIStateStorage = new AsyncLocalStorage<{
  currentState: any;
  originalState: any;
  sealed: boolean;
  options: InternalAIStateStorageOptions;
  mutationDeltaPromise?: Promise<any>;
  mutationDeltaResolve?: (v: any) => void;
}>();

function getAIStateStoreOrThrow(message: string) {
  const store = asyncAIStateStorage.getStore();
  if (!store) {
    throw new Error(message);
  }
  return store;
}

export function withAIState<S, T>(
  { state, options }: { state: S; options: InternalAIStateStorageOptions },
  fn: () => T,
): T {
  return asyncAIStateStorage.run(
    {
      currentState: JSON.parse(JSON.stringify(state)), // deep clone object
      originalState: state,
      sealed: false,
      options,
    },
    fn,
  );
}

export function getAIStateDeltaPromise() {
  const store = getAIStateStoreOrThrow('Internal error occurred.');
  return store.mutationDeltaPromise;
}

// Internal method. This will be called after the AI Action has been returned
// and you can no longer call `getMutableAIState()` inside any async callbacks
// created by that Action.
export function sealMutableAIState() {
  const store = getAIStateStoreOrThrow('Internal error occurred.');
  store.sealed = true;
}

/**
 * Get the current AI state.
 * If `key` is provided, it will return the value of the specified key in the
 * AI state, if it's an object. If it's not an object, it will throw an error.
 *
 * @example const state = getAIState() // Get the entire AI state
 * @example const field = getAIState('key') // Get the value of the key
 */
function getAIState<AI extends AIProvider = any>(): Readonly<
  InferAIState<AI, any>
>;
function getAIState<AI extends AIProvider = any>(
  key: keyof InferAIState<AI, any>,
): Readonly<InferAIState<AI, any>[typeof key]>;
function getAIState<AI extends AIProvider = any>(
  ...args: [] | [key: keyof InferAIState<AI, any>]
) {
  const store = getAIStateStoreOrThrow(
    '`getAIState` must be called within an AI Action.',
  );

  if (args.length > 0) {
    const key = args[0];
    if (typeof store.currentState !== 'object') {
      throw new Error(
        `You can't get the "${String(
          key,
        )}" field from the AI state because it's not an object.`,
      );
    }
    return store.currentState[key as keyof typeof store.currentState];
  }

  return store.currentState;
}

/**
 * Get the mutable AI state. Note that you must call `.done()` when finishing
 * updating the AI state.
 *
 * @example
 * ```tsx
 * const state = getMutableAIState()
 * state.update({ ...state.get(), key: 'value' })
 * state.update((currentState) => ({ ...currentState, key: 'value' }))
 * state.done()
 * ```
 *
 * @example
 * ```tsx
 * const state = getMutableAIState()
 * state.done({ ...state.get(), key: 'value' }) // Done with a new state
 * ```
 */
function getMutableAIState<AI extends AIProvider = any>(): MutableAIState<
  InferAIState<AI, any>
>;
function getMutableAIState<AI extends AIProvider = any>(
  key: keyof InferAIState<AI, any>,
): MutableAIState<InferAIState<AI, any>[typeof key]>;
function getMutableAIState<AI extends AIProvider = any>(
  ...args: [] | [key: keyof InferAIState<AI, any>]
) {
  type AIState = InferAIState<AI, any>;
  type AIStateWithKey = typeof args extends [key: keyof AIState]
    ? AIState[(typeof args)[0]]
    : AIState;
  type NewStateOrUpdater = ValueOrUpdater<AIStateWithKey>;

  const store = getAIStateStoreOrThrow(
    '`getMutableAIState` must be called within an AI Action.',
  );

  if (store.sealed) {
    throw new Error(
      "`getMutableAIState` must be called before returning from an AI Action. Please move it to the top level of the Action's function body.",
    );
  }

  if (!store.mutationDeltaPromise) {
    const { promise, resolve } = createResolvablePromise();
    store.mutationDeltaPromise = promise;
    store.mutationDeltaResolve = resolve;
  }

  function doUpdate(newState: NewStateOrUpdater, done: boolean) {
    if (args.length > 0) {
      if (typeof store.currentState !== 'object') {
        const key = args[0];
        throw new Error(
          `You can't modify the "${String(
            key,
          )}" field of the AI state because it's not an object.`,
        );
      }
    }

    if (isFunction(newState)) {
      if (args.length > 0) {
        store.currentState[args[0]] = newState(store.currentState[args[0]]);
      } else {
        store.currentState = newState(store.currentState);
      }
    } else {
      if (args.length > 0) {
        store.currentState[args[0]] = newState;
      } else {
        store.currentState = newState;
      }
    }

    store.options.onSetAIState?.({
      key: args.length > 0 ? args[0] : undefined,
      state: store.currentState,
      done,
    });
  }

  const mutableState = {
    get: () => {
      if (args.length > 0) {
        const key = args[0];
        if (typeof store.currentState !== 'object') {
          throw new Error(
            `You can't get the "${String(
              key,
            )}" field from the AI state because it's not an object.`,
          );
        }
        return store.currentState[key] as Readonly<AIStateWithKey>;
      }

      return store.currentState as Readonly<AIState>;
    },
    update: function update(newAIState: NewStateOrUpdater) {
      doUpdate(newAIState, false);
    },
    done: function done(...doneArgs: [] | [NewStateOrUpdater]) {
      if (doneArgs.length > 0) {
        doUpdate(doneArgs[0] as NewStateOrUpdater, true);
      }

      const delta = jsondiffpatch.diff(store.originalState, store.currentState);
      store.mutationDeltaResolve!(delta);
    },
  };

  return mutableState;
}

export { getAIState, getMutableAIState };
