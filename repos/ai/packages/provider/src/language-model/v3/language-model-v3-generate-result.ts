import type { SharedV3Headers, SharedV3Warning } from '../../shared';
import type { SharedV3ProviderMetadata } from '../../shared/v3/shared-v3-provider-metadata';
import type { LanguageModelV3Content } from './language-model-v3-content';
import type { LanguageModelV3FinishReason } from './language-model-v3-finish-reason';
import type { LanguageModelV3ResponseMetadata } from './language-model-v3-response-metadata';
import type { LanguageModelV3Usage } from './language-model-v3-usage';

/**
 * The result of a language model doGenerate call.
 */
export type LanguageModelV3GenerateResult = {
  /**
   * Ordered content that the model has generated.
   */
  content: Array<LanguageModelV3Content>;

  /**
   * The finish reason.
   */
  finishReason: LanguageModelV3FinishReason;

  /**
   * The usage information.
   */
  usage: LanguageModelV3Usage;

  /**
   * Additional provider-specific metadata. They are passed through
   * from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   */
  providerMetadata?: SharedV3ProviderMetadata;

  /**
   * Optional request information for telemetry and debugging purposes.
   */
  request?: {
    /**
     * Request HTTP body that was sent to the provider API.
     */
    body?: unknown;
  };

  /**
   * Optional response information for telemetry and debugging purposes.
   */
  response?: LanguageModelV3ResponseMetadata & {
    /**
     * Response headers.
     */
    headers?: SharedV3Headers;

    /**
     * Response HTTP body.
     */
    body?: unknown;
  };

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings: Array<SharedV3Warning>;
};
