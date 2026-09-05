import type { JSONSchema7, LanguageModelV4ToolCall } from '@ai-sdk/provider';
import type { InvalidToolInputError } from '../error/invalid-tool-input-error';
import type { NoSuchToolError } from '../error/no-such-tool-error';
import type { Instructions, ModelMessage } from '../prompt';
import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * A function that attempts to repair a tool call that failed to parse.
 *
 * It receives the error and the context as arguments and returns the repair
 * tool call JSON as text.
 *
 * @param options.instructions - The instructions provided to the model.
 * @param options.system - The instructions provided to the model.
 * @param options.messages - The messages in the current generation step.
 * @param options.toolCall - The tool call that failed to parse.
 * @param options.tools - The tools that are available.
 * @param options.inputSchema - A function that returns the JSON Schema for a tool.
 * @param options.error - The error that occurred while parsing the tool call.
 */
export type ToolCallRepairFunction<TOOLS extends ToolSet> = (options: {
  instructions: Instructions | undefined;
  /**
   * @deprecated Use `instructions` instead.
   */
  system: Instructions | undefined;
  messages: ModelMessage[];
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS;
  inputSchema: (options: { toolName: string }) => PromiseLike<JSONSchema7>;
  error: NoSuchToolError | InvalidToolInputError;
}) => Promise<LanguageModelV4ToolCall | null>;
