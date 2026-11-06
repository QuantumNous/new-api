import { tool, type FlexibleSchema, type Tool } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Cross-harness vocabulary of common built-in tool names with their baseline
 * input schemas. Adapters that declare a built-in with one of these
 * `commonName`s must accept (at least) every input the baseline schema
 * accepts. Extra optional fields are encouraged.
 *
 * Used both as runtime values (spread into `ToolSet`s for inspection) and as
 * a vocabulary source — `HarnessV1BuiltinToolName` is derived from its keys.
 */
export const HARNESS_V1_BUILTIN_TOOLS = {
  read: tool({
    description: 'Read file contents',
    inputSchema: z.object({ file_path: z.string() }),
    outputSchema: z.unknown(),
  }),
  write: tool({
    description: 'Write content to a file',
    inputSchema: z.object({ file_path: z.string(), content: z.string() }),
    outputSchema: z.unknown(),
  }),
  edit: tool({
    description: 'Edit a file by replacing text',
    inputSchema: z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
    outputSchema: z.unknown(),
  }),
  bash: tool({
    description: 'Execute a shell command',
    inputSchema: z.object({ command: z.string() }),
    outputSchema: z.unknown(),
  }),
  grep: tool({
    description: 'Search file contents with regex',
    inputSchema: z.object({ pattern: z.string() }),
    outputSchema: z.unknown(),
  }),
  glob: tool({
    description: 'Find files matching a glob pattern',
    inputSchema: z.object({ pattern: z.string() }),
    outputSchema: z.unknown(),
  }),
  webSearch: tool({
    description: 'Search the web',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.unknown(),
  }),
} as const;

export type HarnessV1BuiltinToolName = keyof typeof HARNESS_V1_BUILTIN_TOOLS;

export const HARNESS_V1_BUILTIN_TOOL_NAMES = Object.keys(
  HARNESS_V1_BUILTIN_TOOLS,
) as ReadonlyArray<HarnessV1BuiltinToolName>;

export type HarnessV1BuiltinToolUseKind = 'readonly' | 'edit' | 'bash';

/**
 * A tool that the adapter's underlying runtime exposes natively. Extends the
 * AI SDK `Tool` shape with two optional harness-specific fields:
 *
 *  - `nativeName`: the name as the underlying runtime knows it. Required
 *    only when the tool's key in the harness's `builtinTools` is not the
 *    native name — i.e. when the tool maps to a `commonName` (e.g. key
 *    `'bash'` for Claude Code's native `'Bash'`). Tools without a common
 *    equivalent are keyed by their native name directly, so `nativeName`
 *    is redundant and omitted.
 *  - `commonName`: cross-harness label drawn from
 *    `HARNESS_V1_BUILTIN_TOOL_NAMES`. Set when the tool maps to a familiar
 *    capability; consumers use it to recognize, e.g., that Claude Code's
 *    `Bash` and Codex's `shell` are the same kind of tool.
 *
 * Always set both fields together via the `commonTool` helper, or neither
 * (declare the tool with the AI SDK's `tool()` directly).
 */
export type HarnessV1BuiltinTool<INPUT = unknown, OUTPUT = unknown> = Tool<
  INPUT,
  OUTPUT,
  any
> & {
  readonly nativeName?: string;
  readonly commonName?: HarnessV1BuiltinToolName;
  readonly toolUseKind?: HarnessV1BuiltinToolUseKind;
};

type InputOf<T> = T extends Tool<infer I, any, any> ? I : never;

type StandardInputOf<N extends HarnessV1BuiltinToolName> = InputOf<
  (typeof HARNESS_V1_BUILTIN_TOOLS)[N]
>;

/*
 * Type-level superset check. If `TStandard` is assignable to `TAdapter`
 * (i.e. the adapter accepts every input the standard accepts), the return
 * type is `TOk`. Otherwise it's a tagged error tuple that surfaces a clear
 * TypeScript error at the call site.
 */
type SupersetCheck<TStandard, TAdapter, TOk> = TStandard extends TAdapter
  ? TOk
  : [
      'ERROR: adapter input schema must be a superset of the standard schema',
      { expected: TStandard; got: TAdapter },
    ];

/**
 * Declare a built-in tool that maps to a cross-harness common name. The
 * adapter's input schema must accept every input the standard schema for
 * `commonName` accepts. Extra optional fields are encouraged.
 *
 * If the schema is missing a field the standard requires (or has an
 * incompatible type), the return type collapses to a tagged error tuple,
 * which fails the surrounding `as const satisfies ToolSet` assignment and
 * surfaces a readable TypeScript error at the offending entry.
 */
export function commonTool<TName extends HarnessV1BuiltinToolName, TInput>(
  commonName: TName,
  opts: {
    readonly nativeName: string;
    readonly toolUseKind?: HarnessV1BuiltinToolUseKind;
    readonly description?: string;
    readonly inputSchema: FlexibleSchema<TInput>;
  },
): SupersetCheck<StandardInputOf<TName>, TInput, HarnessV1BuiltinTool<TInput>> {
  return {
    ...tool({
      description: opts.description,
      inputSchema: opts.inputSchema as FlexibleSchema<TInput>,
    }),
    nativeName: opts.nativeName,
    commonName,
    toolUseKind: opts.toolUseKind,
  } as never;
}
