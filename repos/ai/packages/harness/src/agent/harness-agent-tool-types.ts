import type { HarnessAgentAdapter } from './harness-agent-types';
import type { ToolSet } from '@ai-sdk/provider-utils';

/** Extract the builtin tool set type from a harness adapter parameter. */
export type HarnessBuiltinToolsOf<H> =
  H extends HarnessAgentAdapter<infer T> ? T : never;

/**
 * Type-level merge of a harness's builtin tools with user-defined tools.
 * User tools override builtins on key collision.
 */
export type HarnessAllTools<
  THarness extends HarnessAgentAdapter<any>,
  TUserTools extends ToolSet,
> = Omit<HarnessBuiltinToolsOf<THarness>, keyof TUserTools> & TUserTools;
