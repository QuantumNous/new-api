/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from 'convex/server'
import type * as board from '../board.js'
import type * as crons from '../crons.js'

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  board: typeof board
  crons: typeof crons
}>
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'public'>
>
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'internal'>
>
