import type { SharedV4ProviderReference } from '@ai-sdk/provider';

/**
 * A mapping of provider names to provider-specific file identifiers.
 *
 * Provider references allow files to be identified across different
 * providers without re-uploading, by storing each provider's own
 * identifier for the same logical file.
 */
export type ProviderReference = SharedV4ProviderReference;
