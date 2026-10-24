import type { ModelMessage } from '@ai-sdk/provider-utils';

/**
 * Metadata for a language model request.
 */
export type LanguageModelRequestMetadata = {
  /**
   * The input messages that were sent to the model for this step.
   */
  readonly messages?: Array<ModelMessage>;

  /**
   * Request HTTP body that was sent to the provider API.
   */
  readonly body?: unknown;
};
