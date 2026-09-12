import type {
  HasRequiredKey,
  InferToolSetContext,
  ToolSet,
} from '@ai-sdk/provider-utils';

/**
 * Checks whether a tool context map contains any contextual tool entries.
 */
type IsEmptyObject<OBJECT> = keyof OBJECT extends never ? true : false;

/**
 * Helper type to make the toolsContext parameter optional, required, or
 * unavailable based on the tool set.
 */
export type ToolsContextParameter<TOOLS extends ToolSet> = {
  tools?: TOOLS;
} & (IsEmptyObject<InferToolSetContext<TOOLS>> extends true
  ? { toolsContext?: never }
  : HasRequiredKey<InferToolSetContext<TOOLS>> extends true
    ? { toolsContext: InferToolSetContext<TOOLS> }
    : { toolsContext?: InferToolSetContext<TOOLS> });
