/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import * as React from 'react';

import * as jsondiffpatch from 'jsondiffpatch';
import { isFunction } from '../util/is-function';
import type {
  AIProvider,
  InferActions,
  InferAIState,
  InferUIState,
  InternalAIProviderProps,
  ValueOrUpdater,
} from '../types';

const InternalUIStateProvider = React.createContext<null | any>(null);
const InternalAIStateProvider = React.createContext<undefined | any>(undefined);
const InternalActionProvider = React.createContext<null | any>(null);
const InternalSyncUIStateProvider = React.createContext<null | any>(null);

export function InternalAIProvider({
  children,
  initialUIState,
  initialAIState,
  initialAIStatePatch,
  wrappedActions,
  wrappedSyncUIState,
}: InternalAIProviderProps) {
  if (!('use' in React)) {
    throw new Error('Unsupported React version.');
  }

  const uiState = React.useState(initialUIState);
  const setUIState = uiState[1];

  const resolvedInitialAIStatePatch = initialAIStatePatch
    ? (React as any).use(initialAIStatePatch)
    : undefined;
  initialAIState = React.useMemo(() => {
    if (resolvedInitialAIStatePatch) {
      return jsondiffpatch.patch(
        jsondiffpatch.clone(initialAIState),
        resolvedInitialAIStatePatch,
      );
    }
    return initialAIState;
  }, [initialAIState, resolvedInitialAIStatePatch]);

  const aiState = React.useState(initialAIState);
  const setAIState = aiState[1];
  const aiStateRef = React.useRef(aiState[0]);

  React.useEffect(() => {
    aiStateRef.current = aiState[0];
  }, [aiState[0]]);

  const clientWrappedActions = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(wrappedActions).map(([key, action]) => [
          key,
          async (...args: any) => {
            const aiStateSnapshot = aiStateRef.current;
            const [aiStateDelta, result] = await action(
              aiStateSnapshot,
              ...args,
            );
            (async () => {
              const delta = await aiStateDelta;
              if (delta !== undefined) {
                aiState[1](
                  jsondiffpatch.patch(
                    jsondiffpatch.clone(aiStateSnapshot),
                    delta,
                  ),
                );
              }
            })();
            return result;
          },
        ]),
      ),
    [wrappedActions],
  );

  const clientWrappedSyncUIStateAction = React.useMemo(() => {
    if (!wrappedSyncUIState) {
      return () => {};
    }

    return async () => {
      const aiStateSnapshot = aiStateRef.current;
      const [aiStateDelta, uiState] =
        await wrappedSyncUIState!(aiStateSnapshot);

      if (uiState !== undefined) {
        setUIState(uiState);
      }

      const delta = await aiStateDelta;
      if (delta !== undefined) {
        const patchedAiState = jsondiffpatch.patch(
          jsondiffpatch.clone(aiStateSnapshot),
          delta,
        );
        setAIState(patchedAiState);
      }
    };
  }, [wrappedSyncUIState]);

  return (
    <InternalAIStateProvider.Provider value={aiState}>
      <InternalUIStateProvider.Provider value={uiState}>
        <InternalActionProvider.Provider value={clientWrappedActions}>
          <InternalSyncUIStateProvider.Provider
            value={clientWrappedSyncUIStateAction}
          >
            {children}
          </InternalSyncUIStateProvider.Provider>
        </InternalActionProvider.Provider>
      </InternalUIStateProvider.Provider>
    </InternalAIStateProvider.Provider>
  );
}

export function useUIState<AI extends AIProvider = any>() {
  type T = InferUIState<AI, any>;

  const state = React.useContext<
    [T, (v: T | ((v_: T) => T)) => void] | null | undefined
  >(InternalUIStateProvider);
  if (state === null) {
    throw new Error('`useUIState` must be used inside an <AI> provider.');
  }
  if (!Array.isArray(state)) {
    throw new Error('Invalid state');
  }
  if (state[0] === undefined) {
    throw new Error(
      '`initialUIState` must be provided to `createAI` or `<AI>`',
    );
  }
  return state;
}

// TODO: How do we avoid causing a re-render when the AI state changes but you
// are only listening to a specific key? We need useSES perhaps?
function useAIState<AI extends AIProvider = any>(): [
  InferAIState<AI, any>,
  (newState: ValueOrUpdater<InferAIState<AI, any>>) => void,
];
function useAIState<AI extends AIProvider = any>(
  key: keyof InferAIState<AI, any>,
): [
  InferAIState<AI, any>[typeof key],
  (newState: ValueOrUpdater<InferAIState<AI, any>[typeof key]>) => void,
];
function useAIState<AI extends AIProvider = any>(
  ...args: [] | [keyof InferAIState<AI, any>]
) {
  type T = InferAIState<AI, any>;

  const state = React.useContext<
    [T, (newState: ValueOrUpdater<T>) => void] | null | undefined
  >(InternalAIStateProvider);
  if (state === null) {
    throw new Error('`useAIState` must be used inside an <AI> provider.');
  }
  if (!Array.isArray(state)) {
    throw new Error('Invalid state');
  }
  if (state[0] === undefined) {
    throw new Error(
      '`initialAIState` must be provided to `createAI` or `<AI>`',
    );
  }
  if (args.length >= 1 && typeof state[0] !== 'object') {
    throw new Error(
      'When using `useAIState` with a key, the AI state must be an object.',
    );
  }

  const key = args[0];
  const setter = React.useCallback(
    typeof key === 'undefined'
      ? state[1]
      : (newState: ValueOrUpdater<T>) => {
          if (isFunction(newState)) {
            return state[1](s => {
              return { ...s, [key]: newState(s[key]) };
            });
          } else {
            return state[1]({ ...state[0], [key]: newState });
          }
        },
    [key],
  );

  if (args.length === 0) {
    return state;
  } else {
    return [state[0][args[0]], setter];
  }
}

export function useActions<AI extends AIProvider = any>() {
  type T = InferActions<AI, any>;

  const actions = React.useContext<T>(InternalActionProvider);
  return actions;
}

export function useSyncUIState() {
  const syncUIState = React.useContext<() => Promise<void>>(
    InternalSyncUIStateProvider,
  );

  if (syncUIState === null) {
    throw new Error('`useSyncUIState` must be used inside an <AI> provider.');
  }

  return syncUIState;
}

export { useAIState };
