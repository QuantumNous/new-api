import type { ToolSet } from '@ai-sdk/provider-utils';
import type { ActiveTools } from './active-tools';

export type ActiveToolSubset<
  TOOLS extends ToolSet | undefined,
  ACTIVE_TOOL_NAMES extends ActiveTools<NonNullable<TOOLS>>,
> = TOOLS extends undefined
  ? undefined
  : [ACTIVE_TOOL_NAMES] extends [NonNullable<ActiveTools<NonNullable<TOOLS>>>]
    ? Pick<NonNullable<TOOLS>, ACTIVE_TOOL_NAMES[number]>
    : TOOLS;

/**
 * Filters the tools to only include the active tools.
 * When activeTools is provided, we only include the tools that are in the list.
 *
 * @param tools - The tools to filter.
 * @param activeTools - The active tools to include.
 * @returns The filtered tools.
 */
export function filterActiveTools<
  TOOLS extends ToolSet | undefined,
  ACTIVE_TOOL_NAMES extends ActiveTools<NonNullable<TOOLS>>,
>({
  tools,
  activeTools,
}: {
  tools: TOOLS;
  activeTools: ACTIVE_TOOL_NAMES;
}): ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES> {
  if (tools == null || activeTools == null) {
    return tools as ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES>;
  }

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => activeTools.includes(name)),
  ) as ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES>;
}
