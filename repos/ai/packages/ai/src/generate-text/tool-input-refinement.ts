import type {
  InferToolInput,
  MaybePromiseLike,
  ToolSet,
} from '@ai-sdk/provider-utils';

/**
 * Mapping of tool names to functions that refine parsed tool inputs.
 *
 * Each refinement function receives the typed input for its tool and must return
 * an input with the same type shape. Refined inputs are used for tool execution,
 * output parts, lifecycle callbacks, and telemetry.
 */
export type ToolInputRefinement<TOOLS extends ToolSet> = {
  [NAME in keyof TOOLS]?: (
    input: InferToolInput<TOOLS[NAME]>,
  ) => MaybePromiseLike<InferToolInput<TOOLS[NAME]>>;
};
