import type { ModelMessage, SystemModelMessage } from '@ai-sdk/provider-utils';

/**
 * Instructions to include in the prompt. Can be used with `prompt` or `messages`.
 */
export type Instructions =
  | string
  | SystemModelMessage
  | Array<SystemModelMessage>;

/**
 * Prompt part of the AI function options.
 * It contains instructions, a simple text prompt, or a list of messages.
 */
export type Prompt = {
  /**
   * Instructions to include in the prompt. Can be used with `prompt` or `messages`.
   */
  instructions?: Instructions;

  /**
   * Instructions to include in the prompt. Can be used with `prompt` or `messages`.
   *
   * @deprecated Use `instructions` instead.
   */
  system?: Instructions;

  /**
   * Whether system messages are allowed in the `prompt` or `messages` fields.
   *
   * When disabled, system messages must be provided through the `instructions`
   * option.
   *
   * @default false
   */
  allowSystemInMessages?: boolean;
} & (
  | {
      /**
       * A prompt. It can be either a text prompt or a list of messages.
       *
       * You can either use `prompt` or `messages` but not both.
       */
      prompt: string | Array<ModelMessage>;

      /**
       * A list of messages.
       *
       * You can either use `prompt` or `messages` but not both.
       */
      messages?: never;
    }
  | {
      /**
       * A list of messages.
       *
       * You can either use `prompt` or `messages` but not both.
       */
      messages: Array<ModelMessage>;

      /**
       * A prompt. It can be either a text prompt or a list of messages.
       *
       * You can either use `prompt` or `messages` but not both.
       */
      prompt?: never;
    }
);
