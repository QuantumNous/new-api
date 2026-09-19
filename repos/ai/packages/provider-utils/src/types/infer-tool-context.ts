import type { Context } from './context';
import type { Tool } from './tool';

/**
 * Detects the `any` type so untyped tools can be treated as having no explicit
 * context type.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Detects exact empty object contexts, including `{}` combined with
 * `undefined`, which do not provide tool-specific context properties.
 */
type IsEmptyObject<T> = keyof NonNullable<T> extends never ? true : false;

/**
 * Detects context types that come from omitted or broad context declarations
 * rather than a concrete tool context schema.
 */
type IsUntypedContext<CONTEXT> =
  IsAny<CONTEXT> extends true
    ? true
    : unknown extends CONTEXT
      ? true
      : IsEmptyObject<CONTEXT> extends true
        ? true
        : string extends keyof CONTEXT
          ? CONTEXT extends Context
            ? true
            : false
          : false;

/**
 * Infer the context type of a tool.
 */
export type InferToolContext<TOOL extends Tool> =
  TOOL extends Tool<any, any, infer CONTEXT>
    ? IsUntypedContext<CONTEXT> extends true
      ? never
      : CONTEXT
    : never;
