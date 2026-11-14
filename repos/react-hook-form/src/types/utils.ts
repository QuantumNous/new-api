import type { NestedValue } from './form';

/*
Projects that React Hook Form installed don't include the DOM library need these interfaces to compile.
React Native applications is no DOM available. The JavaScript runtime is ES6/ES2015 only.
These definitions allow such projects to compile with only --lib ES6.

Warning: all of these interfaces are empty.
If you want type definitions for various properties, you need to add `--lib DOM` (via command line or tsconfig.json).
*/

export type Noop = () => void;

interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
}

interface FileList {
  readonly length: number;
  item(index: number): File | null;
  [index: number]: File;
}

export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint;

export type BrowserNativeObject = Date | FileList | File;

export type EmptyObject = { [K in string | number]: never };

export type NonUndefined<T> = T extends undefined ? never : T;

export type LiteralUnion<T extends U, U extends Primitive> =
  | T
  | (U & { _?: never });

export type ExtractObjects<T> = T extends infer U
  ? U extends object
    ? U
    : never
  : never;

type IsPrimitiveLike<T> = T extends Primitive
  ? true
  : T extends Primitive & object
    ? true
    : false;

export type DeepPartial<T> =
  IsPrimitiveLike<T> extends true
    ? T
    : T extends BrowserNativeObject | NestedValue
      ? T
      : {
          [K in keyof T]?: ExtractObjects<T[K]> extends never
            ? T[K]
            : DeepPartial<T[K]>;
        };

export type DeepPartialSkipArrayKey<T> =
  IsPrimitiveLike<T> extends true
    ? T
    : T extends BrowserNativeObject | NestedValue
      ? T
      : T extends ReadonlyArray<any>
        ? { [K in keyof T]: DeepPartialSkipArrayKey<T[K]> }
        : { [K in keyof T]?: DeepPartialSkipArrayKey<T[K]> };

/**
 * Checks whether the type is any
 * See {@link https://stackoverflow.com/a/49928360/3406963}
 * @typeParam T - type which may be any
 * ```
 * IsAny<any> = true
 * IsAny<string> = false
 * ```
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Checks whether the type is never
 * @typeParam T - type which may be never
 * ```
 * IsNever<never> = true
 * IsNever<string> = false
 * ```
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Checks whether T1 can be exactly (mutually) assigned to T2
 * @typeParam T1 - type to check
 * @typeParam T2 - type to check against
 * ```
 * IsEqual<string, string> = true
 * IsEqual<'foo', 'foo'> = true
 * IsEqual<string, number> = false
 * IsEqual<string, number> = false
 * IsEqual<string, 'foo'> = false
 * IsEqual<'foo', string> = false
 * IsEqual<'foo' | 'bar', 'foo'> = boolean // 'foo' is assignable, but 'bar' is not (true | false) -> boolean
 * ```
 */
export type IsEqual<T1, T2> = T1 extends T2
  ? (<G>() => G extends T1 ? 1 : 2) extends <G>() => G extends T2 ? 1 : 2
    ? true
    : false
  : false;

export type DeepMap<T, TValue> =
  IsAny<T> extends true
    ? any
    : T extends BrowserNativeObject | NestedValue
      ? TValue
      : T extends ReadonlyArray<infer U>
        ? Array<DeepMap<NonUndefined<U>, TValue> | undefined>
        : T extends object
          ? { [K in keyof T]: DeepMap<NonUndefined<T[K]>, TValue> }
          : TValue;

export type IsFlatObject<T extends object> =
  Extract<
    Exclude<T[keyof T], NestedValue | Date | FileList>,
    any[] | object
  > extends never
    ? true
    : false;

export type Merge<A, B> = {
  [K in keyof A | keyof B]?: K extends keyof A & keyof B
    ? [A[K], B[K]] extends [object, object]
      ? Merge<A[K], B[K]>
      : B[K]
    : K extends keyof A
      ? A[K]
      : K extends keyof B
        ? B[K]
        : never;
};
