export type JSONValue = string | number | boolean | JSONObject | JSONArray;

interface JSONObject {
  [x: string]: JSONValue | undefined;
}

interface JSONArray extends Array<JSONValue> {}

export type AIAction<T = any, R = any> = (...args: T[]) => Promise<R>;
export type AIActions<T = any, R = any> = Record<string, AIAction<T, R>>;

export type ServerWrappedAction<T = unknown> = (
  aiState: T,
  ...args: unknown[]
) => Promise<[Promise<T>, unknown]>;
export type ServerWrappedActions<T = unknown> = Record<
  string,
  ServerWrappedAction<T>
>;

export type InternalAIProviderProps<AIState = any, UIState = any> = {
  children: React.ReactNode;
  initialUIState: UIState;
  initialAIState: AIState;
  initialAIStatePatch: undefined | Promise<AIState>;
  wrappedActions: ServerWrappedActions<AIState>;
  wrappedSyncUIState?: ServerWrappedAction<AIState>;
};

export type AIProviderProps<AIState = any, UIState = any, Actions = any> = {
  children: React.ReactNode;
  initialAIState?: AIState;
  initialUIState?: UIState;
  /** $ActionTypes is only added for type inference and is never used at runtime **/
  $ActionTypes?: Actions;
};

export type AIProvider<AIState = any, UIState = any, Actions = any> = (
  props: AIProviderProps<AIState, UIState, Actions>,
) => Promise<React.ReactElement>;

export type InferAIState<T, Fallback> =
  T extends AIProvider<infer AIState, any, any> ? AIState : Fallback;
export type InferUIState<T, Fallback> =
  T extends AIProvider<any, infer UIState, any> ? UIState : Fallback;
export type InferActions<T, Fallback> =
  T extends AIProvider<any, any, infer Actions> ? Actions : Fallback;

export type InternalAIStateStorageOptions = {
  onSetAIState?: OnSetAIState<any>;
};

export type OnSetAIState<S> = ({
  key,
  state,
  done,
}: {
  key: string | number | symbol | undefined;
  state: S;
  done: boolean;
}) => void | Promise<void>;

export type OnGetUIState<S> = AIAction<void, S | undefined>;

export type ValueOrUpdater<T> = T | ((current: T) => T);

export type MutableAIState<AIState> = {
  get: () => AIState;
  update: (newState: ValueOrUpdater<AIState>) => void;
  done: ((newState: AIState) => void) | (() => void);
};
