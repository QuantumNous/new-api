export type Falsy = false | null | undefined;

export type OneOrMany<T> = T | T[];

export type MaybePromise<T> = T | Promise<T>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// https://github.com/microsoft/TypeScript/issues/29729
export type LiteralUnion<T extends U, U> = T | (U & Record<never, never>);

/**
 * Creates a type with readonly properties at the first and second levels only.
 */
export type TwoLevelReadonly<T> = keyof T extends never
  ? T
  : {
      readonly [k in keyof T]: T[k] extends object ? { readonly [p in keyof T[k]]: T[k][p] } : T[k];
    };

export type ConfigChain<T> = OneOrMany<T | ((config: T) => T | void)>;

export type ConfigChainWithContext<T, Ctx> = OneOrMany<T | ((config: T, ctx: Ctx) => T | void)>;

export type ConfigChainAsyncWithContext<T, Ctx> = OneOrMany<
  T | ((config: T, ctx: Ctx) => MaybePromise<T | void>)
>;
