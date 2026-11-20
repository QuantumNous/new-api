import type { Tool } from './tool';

/**
 * A tool that is guaranteed to expose an execute function.
 */
export type ExecutableTool<TOOL extends Tool = Tool> = TOOL & {
  execute: NonNullable<TOOL['execute']>;
};

/**
 * Checks whether a tool exposes an execute function.
 */
export function isExecutableTool<TOOL extends Tool>(
  tool: TOOL | undefined,
): tool is ExecutableTool<TOOL> {
  return tool != null && typeof tool.execute === 'function';
}
