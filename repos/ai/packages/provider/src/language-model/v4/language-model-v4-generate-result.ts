import type { SharedV4Headers, SharedV4Warning } from '../../shared';
import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { LanguageModelV4Content } from './language-model-v4-content';
import type { LanguageModelV4FinishReason } from './language-model-v4-finish-reason';
import type { LanguageModelV4ResponseMetadata } from './language-model-v4-response-metadata';
import type { LanguageModelV4Usage } from './language-model-v4-usage';

/**
 * The result of a language model doGenerate call.
 */
export type LanguageModelV4GenerateResult = {
  /**
   * Ordered content that the model has generated.
   */
  content: Array<LanguageModelV4Content>;

  /**
   * The finish reason.
   */
  finishReason: LanguageModelV4FinishReason;

  /**
   * The usage information.
   */
  usage: LanguageModelV4Usage;

  /**
   * Additional provider-specific metadata. They are passed through
   * from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   */
  providerMetadata?: SharedV4ProviderMetadata;

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
  response?: LanguageModelV4ResponseMetadata & {
    /**
     * Response headers.
     */
    headers?: SharedV4Headers;

    /**
     * Response HTTP body.
     */
    body?: unknown;
  };

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings: Array<SharedV4Warning>;
};
