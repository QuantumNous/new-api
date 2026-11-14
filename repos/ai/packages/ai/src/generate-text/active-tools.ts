import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * Tool names that are enabled for a generation step.
 *
 * `undefined` means no tool restriction is applied. Tool names are object keys
 * at runtime, so the type is restricted to the string keys of the configured
 * tool set.
 */
export type ActiveTools<TOOLS extends ToolSet> =
  | ReadonlyArray<keyof TOOLS & string>
  | undefined;
