import type { JSONSchema7 } from 'json-schema';

/**
 * A tool definition for realtime models. Sent as part of the session
 * configuration so the model knows which functions it can call.
 */
export type RealtimeModelV4ToolDefinition = {
  /**
   * The type of the tool (always 'function').
   */
  type: 'function';

  /**
   * The name of the tool. Unique within the session.
   */
  name: string;

  /**
   * A description of what the tool does. The model uses this to decide
   * whether to call the tool.
   */
  description?: string;

  /**
   * JSON Schema describing the parameters the tool expects.
   */
  parameters: JSONSchema7;
};
