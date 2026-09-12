import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * Tool names that define the order in which tools are sent to the provider.
 *
 * Tool names are object keys at runtime, so the type is restricted to the
 * string keys of the configured tool set. The list can be partial; tools not
 * listed in `toolOrder` are sent after the listed tools, sorted alphabetically.
 */
export type ToolOrder<TOOLS extends ToolSet> =
  | ReadonlyArray<keyof TOOLS & string>
  | undefined;
