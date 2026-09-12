import type { SharedV4ProviderMetadata } from '../../shared';

/**
 * Reasoning that the model has generated.
 */
export type LanguageModelV4Reasoning = {
  type: 'reasoning';
  text: string;

  /**
   * Optional provider-specific metadata for the reasoning part.
   */
  providerMetadata?: SharedV4ProviderMetadata;
};
