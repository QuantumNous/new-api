import type { Context, ToolSet } from '@ai-sdk/provider-utils';
import type { StepResult } from './step-result';

/**
 * A predicate that decides whether a tool-calling loop should stop after the
 * current step.
 *
 * A tool calling loop continues until one of the following conditions is met:
 * - The model returns a finish reason other than `tool-calls`
 * - A tool without an execute function is called
 * - A tool call needs approval
 * - One of the provided stop conditions returns `true`
 */
export type StopCondition<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = (options: {
  steps: Array<StepResult<TOOLS, RUNTIME_CONTEXT>>;
}) => PromiseLike<boolean> | boolean;

/**
 * Creates a stop condition that returns `true` when the number of completed
 * steps equals `stepCount`.
 *
 * @param stepCount - The number of steps to allow before stopping.
 */
export function isStepCount(stepCount: number): StopCondition<any, any> {
  return ({ steps }) => steps.length === stepCount;
}

/**
 * Creates a stop condition that never returns `true`.
 *
 * This lets the tool-calling loop continue until it reaches one of its
 * natural termination conditions.
 */
export function isLoopFinished(): StopCondition<any, any> {
  return () => false;
}

/**
 * Creates a stop condition that returns `true` when the most recent step
 * contains a tool call with any of the specified names.
 *
 * @param toolName - The names of the tools that should stop the loop.
 */
export function hasToolCall<TOOLS extends ToolSet>(
  ...toolName: Array<keyof TOOLS | (string & {})> // autocomplete support for tool names
): StopCondition<TOOLS, any> {
  return ({ steps }) =>
    steps[steps.length - 1]?.toolCalls?.some(toolCall =>
      toolName.includes(toolCall.toolName),
    ) ?? false;
}

/**
 * Evaluates the provided stop conditions for the current list of steps.
 *
 * Returns `true` as soon as any stop condition is met.
 *
 * @param stopConditions - The stop conditions to evaluate.
 * @param steps - The completed steps accumulated so far.
 */
export async function isStopConditionMet<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
>({
  stopConditions,
  steps,
}: {
  stopConditions: Array<StopCondition<TOOLS, RUNTIME_CONTEXT>>;
  steps: Array<StepResult<TOOLS, RUNTIME_CONTEXT>>;
}): Promise<boolean> {
  return (
    await Promise.all(stopConditions.map(condition => condition({ steps })))
  ).some(result => result);
}
