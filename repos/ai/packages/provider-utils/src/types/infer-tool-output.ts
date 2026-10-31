import type { Tool } from './tool';

/**
 * Infer the output type of a tool.
 */
export type InferToolOutput<TOOL extends Tool<any, any, any>> =
  TOOL extends Tool<any, infer OUTPUT, any> ? OUTPUT : never;
