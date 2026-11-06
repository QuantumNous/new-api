import type { JSONObject } from '@ai-sdk/provider';
import type { InferToolInput, ToolSet } from '@ai-sdk/provider-utils';
import type { ProviderMetadata } from '../types';
import type { ValueOf } from '../util/value-of';

export type StaticToolError<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: {
    type: 'tool-error';
    toolCallId: string;
    toolName: NAME & string;
    input: InferToolInput<TOOLS[NAME]>;
    error: unknown;
    providerExecuted?: boolean;
    providerMetadata?: ProviderMetadata;
    toolMetadata?: JSONObject;
    dynamic?: false | undefined;
    title?: string;
  };
}>;

export type DynamicToolError = {
  type: 'tool-error';
  toolCallId: string;
  toolName: string;
  input: unknown;
  error: unknown;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
  toolMetadata?: JSONObject;
  dynamic: true;
  title?: string;
};

export type TypedToolError<TOOLS extends ToolSet> =
  | StaticToolError<TOOLS>
  | DynamicToolError;
