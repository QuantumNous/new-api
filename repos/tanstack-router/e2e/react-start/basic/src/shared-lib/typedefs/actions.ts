/**
 * This file contains ONLY type exports.
 * After TypeScript compilation, this becomes an empty JavaScript module.
 * This tests that the compiler can handle re-exports through type-only modules.
 *
 * See: https://github.com/TanStack/router/issues/6198
 */

// biome-ignore lint/suspicious/noExplicitAny: Generic server function type
export type Action = (...deps: any[]) => any
export type ActionParams<TFunction extends Action> = Parameters<TFunction>[0]
