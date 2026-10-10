import type { FlexibleSchema } from '@ai-sdk/provider-utils';
import {
  useObject,
  type UseObjectHelpers,
  type UseObjectOptions,
} from './use-object';

export * from './use-completion';
export { Chat } from './chat.vue';
export { useChat, type UseChatHelpers } from './use-chat';
export * from './use-object';

// deprecated aliases
// note: declared here (instead of export aliases) so that the `@deprecated`
// tags are preserved in the bundled type declarations

/**
 * @deprecated Use `useObject` instead.
 */
export const experimental_useObject = useObject;

/**
 * @deprecated Use `UseObjectOptions` instead.
 */
export type Experimental_UseObjectOptions<
  SCHEMA extends FlexibleSchema,
  RESULT,
> = UseObjectOptions<SCHEMA, RESULT>;

/**
 * @deprecated Use `UseObjectHelpers` instead.
 */
export type Experimental_UseObjectHelpers<RESULT, INPUT> = UseObjectHelpers<
  RESULT,
  INPUT
>;
