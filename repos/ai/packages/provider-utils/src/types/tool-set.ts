import type { Tool } from './tool';

/**
 * A mapping of tool names to tool definitions.
 */
export type ToolSet = Record<
  string,
  (
    | Tool<never, never, any>
    | Tool<any, any, any>
    | Tool<any, never, any>
    | Tool<never, any, any>
  ) &
    Pick<
      Tool<any, any, any>,
      | 'execute'
      | 'onInputAvailable'
      | 'onInputStart'
      | 'onInputDelta'
      | 'needsApproval'
    >
>;
