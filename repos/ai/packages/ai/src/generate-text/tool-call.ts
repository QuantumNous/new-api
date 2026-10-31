import type { JSONObject } from '@ai-sdk/provider';
import type { InferToolInput, ToolSet } from '@ai-sdk/provider-utils';
import type { ProviderMetadata } from '../types';
import type { ValueOf } from '../util/value-of';

type BaseToolCall = {
  type: 'tool-call';
  toolCallId: string;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
  toolMetadata?: JSONObject;
};

/**
 * A tool call whose `toolName` maps to a tool in the declared tool set,
 * with an `input` type inferred from that tool's input schema.
 */
export type StaticToolCall<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: BaseToolCall & {
    toolName: NAME & string;
    input: InferToolInput<TOOLS[NAME]>;
    dynamic?: false | undefined;
    invalid?: false | undefined;
    error?: never;
    title?: string;
  };
}>;

/**
 * A tool call whose `toolName` is only known at runtime, such as an invalid
 * or otherwise untyped call that cannot be matched to the declared tool set.
 */
export type DynamicToolCall = BaseToolCall & {
  toolName: string;
  input: unknown;
  dynamic: true;
  title?: string;

  /**
   * True if this is caused by an unparsable tool call or
   * a tool that does not exist.
   */
  // Added into DynamicToolCall to avoid breaking changes.
  // TODO AI SDK 6: separate into a new InvalidToolCall type
  invalid?: boolean;

  /**
   * The error that caused the tool call to be invalid.
   */
  // TODO AI SDK 6: separate into a new InvalidToolCall type
  error?: unknown;
};

/**
 * A tool call returned by text generation, either statically typed from the
 * declared tool set or dynamically typed when the tool cannot be inferred.
 */
export type TypedToolCall<TOOLS extends ToolSet> =
  | StaticToolCall<TOOLS>
  | DynamicToolCall;
