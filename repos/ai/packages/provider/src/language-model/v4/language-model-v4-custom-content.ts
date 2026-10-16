import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';

/**
 * A provider-specific content block that does not map to another standardized
 * content part type.
 */
export type LanguageModelV4CustomContent = {
  type: 'custom';

  /**
   * The kind of custom content, in the format `{provider}.{provider-type}`.
   */
  kind: `${string}.${string}`;

  /**
   * Additional provider-specific options. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: SharedV4ProviderMetadata;
};
