import type { ServerComponentStream } from './ServerComponentTypes'

/**
 * Handle returned by RSC helpers.
 * Contains the RSC Flight stream that can be consumed by SSR and/or Client.
 */
export interface ServerComponentHandle {
  readonly stream: ServerComponentStream
}

/**
 * Slot implementations provided to ServerComponentRenderer.
 * Keys are slot names, values are either React nodes (for children) or render functions.
 */
export type SlotImplementations = Record<string, unknown>
