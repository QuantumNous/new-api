import { HarnessCapabilityUnsupportedError } from '../../errors/harness-capability-unsupported-error';
import type { HarnessV1, HarnessV1BuiltinToolFiltering } from '../../v1';
import { NoSuchToolError, type ActiveTools } from 'ai';
import type { ToolSet } from '@ai-sdk/provider-utils';

export type ResolvedHarnessAgentToolFiltering<TUserTools extends ToolSet> = {
  readonly activeUserTools: TUserTools;
  readonly builtinToolFiltering?: HarnessV1BuiltinToolFiltering;
};

export function resolveHarnessAgentToolFiltering<
  TAllTools extends ToolSet,
  TUserTools extends ToolSet,
>(input: {
  harness: HarnessV1;
  userTools: TUserTools;
  allTools: TAllTools;
  activeTools: ActiveTools<TAllTools>;
  inactiveTools: ActiveTools<TAllTools>;
}): ResolvedHarnessAgentToolFiltering<TUserTools> {
  if (input.activeTools !== undefined && input.inactiveTools !== undefined) {
    throw new Error(
      'HarnessAgent: pass either `activeTools` or `inactiveTools`, not both.',
    );
  }

  const allToolNames = Object.keys(input.allTools);
  const activeTools = dedupeToolNames({ toolNames: input.activeTools });
  const inactiveTools = dedupeToolNames({ toolNames: input.inactiveTools });
  validateToolNames({
    requestedToolNames: activeTools ?? inactiveTools,
    availableToolNames: allToolNames,
  });

  const userToolNames = Object.keys(input.userTools);
  const activeUserToolNames =
    activeTools != null
      ? userToolNames.filter(name => activeTools.includes(name))
      : inactiveTools != null
        ? userToolNames.filter(name => !inactiveTools.includes(name))
        : userToolNames;

  const builtinToolNames = Object.keys(input.harness.builtinTools);
  const disabledBuiltinToolNames =
    activeTools != null
      ? builtinToolNames.filter(name => !activeTools.includes(name))
      : inactiveTools != null
        ? builtinToolNames.filter(name => inactiveTools.includes(name))
        : [];

  const builtinToolFiltering =
    disabledBuiltinToolNames.length > 0
      ? activeTools != null
        ? {
            mode: 'allow' as const,
            toolNames: builtinToolNames.filter(name =>
              activeTools.includes(name),
            ),
          }
        : { mode: 'deny' as const, toolNames: disabledBuiltinToolNames }
      : undefined;

  if (
    builtinToolFiltering != null &&
    input.harness.supportsBuiltinToolFiltering !== true &&
    input.harness.supportsBuiltinToolApprovals !== true
  ) {
    throw new HarnessCapabilityUnsupportedError({
      message: `Harness '${input.harness.harnessId}' does not support built-in tool filtering controls.`,
      harnessId: input.harness.harnessId,
    });
  }

  return {
    activeUserTools: filterToolSet({
      tools: input.userTools,
      toolNames: activeUserToolNames,
    }),
    ...(builtinToolFiltering != null ? { builtinToolFiltering } : {}),
  };
}

function dedupeToolNames(input: {
  toolNames: ReadonlyArray<string> | undefined;
}): ReadonlyArray<string> | undefined {
  return input.toolNames == null
    ? undefined
    : Array.from(new Set(input.toolNames));
}

function validateToolNames(input: {
  requestedToolNames: ReadonlyArray<string> | undefined;
  availableToolNames: ReadonlyArray<string>;
}): void {
  if (input.requestedToolNames == null) return;
  for (const toolName of input.requestedToolNames) {
    if (!input.availableToolNames.includes(toolName)) {
      throw new NoSuchToolError({
        toolName,
        availableTools: [...input.availableToolNames],
      });
    }
  }
}

function filterToolSet<TUserTools extends ToolSet>(input: {
  tools: TUserTools;
  toolNames: ReadonlyArray<string>;
}): TUserTools {
  const allowed = new Set(input.toolNames);
  return Object.fromEntries(
    Object.entries(input.tools).filter(([name]) => allowed.has(name)),
  ) as TUserTools;
}
