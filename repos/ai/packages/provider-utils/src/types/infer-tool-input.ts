import type { Tool } from './tool';

/**
 * Infer the input type of a tool.
 */
export type InferToolInput<TOOL extends Tool<any, any, any>> =
  TOOL extends Tool<infer INPUT, any, any> ? INPUT : never;
