import type { FlexibleSchema, InferSchema } from '@ai-sdk/provider-utils';
import {
  StructuredObject,
  type StructuredObjectOptions,
} from './structured-object.svelte.js';

export { Chat, type CreateUIMessage, type UIMessage } from './chat.svelte.js';
export { Completion, type CompletionOptions } from './completion.svelte.js';
export { createAIContext } from './context-provider.js';
export {
  StructuredObject,
  type StructuredObjectOptions,
} from './structured-object.svelte.js';

// deprecated aliases
// note: declared here (instead of export aliases) so that the `@deprecated`
// tags are preserved in the bundled type declarations

/**
 * @deprecated Use `StructuredObject` instead.
 */
export const Experimental_StructuredObject = StructuredObject;
/**
 * @deprecated Use `StructuredObject` instead.
 */
export type Experimental_StructuredObject<
  SCHEMA extends FlexibleSchema,
  RESULT = InferSchema<SCHEMA>,
  INPUT = unknown,
> = StructuredObject<SCHEMA, RESULT, INPUT>;

/**
 * @deprecated Use `StructuredObjectOptions` instead.
 */
export type Experimental_StructuredObjectOptions<
  SCHEMA extends FlexibleSchema,
  RESULT = InferSchema<SCHEMA>,
> = StructuredObjectOptions<SCHEMA, RESULT>;
