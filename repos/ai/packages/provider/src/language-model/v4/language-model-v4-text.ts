import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';

/**
 * Text that the model has generated.
 */
export type LanguageModelV4Text = {
  type: 'text';

  /**
   * The text content.
   */
  text: string;

  providerMetadata?: SharedV4ProviderMetadata;
};
