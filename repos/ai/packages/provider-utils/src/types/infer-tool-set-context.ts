import type { InferToolContext } from './infer-tool-context';
import type { ToolSet } from './tool-set';

/**
 * Builds the required portion of the tool context map for tools whose context
 * type does not include `undefined`.
 */
type RequiredToolSetContext<TOOLS extends ToolSet> = {
  [K in keyof TOOLS as InferToolContext<NoInfer<TOOLS[K]>> extends never
    ? never
    : undefined extends InferToolContext<NoInfer<TOOLS[K]>>
      ? never
      : K]: InferToolContext<NoInfer<TOOLS[K]>>;
};

/**
 * Builds the optional portion of the tool context map for tools whose context
 * object itself may be `undefined`.
 */
type OptionalToolSetContext<TOOLS extends ToolSet> = {
  [K in keyof TOOLS as InferToolContext<NoInfer<TOOLS[K]>> extends never
    ? never
    : undefined extends InferToolContext<NoInfer<TOOLS[K]>>
      ? K
      : never]?: InferToolContext<NoInfer<TOOLS[K]>>;
};

/**
 * Flattens intersected mapped types so type equality assertions and editor
 * hovers show the resulting object shape.
 */
type Normalize<OBJECT> = { [KEY in keyof OBJECT]: OBJECT[KEY] };

/**
 * Infer the context type for a tool set.
 *
 * The inferred type maps each contextual tool name to its context type.
 *
 * Tools without concrete context are omitted. Tool contexts that include
 * `undefined` are represented as optional properties.
 */
export type InferToolSetContext<TOOLS extends ToolSet> = Normalize<
  RequiredToolSetContext<TOOLS> & OptionalToolSetContext<TOOLS>
>;
