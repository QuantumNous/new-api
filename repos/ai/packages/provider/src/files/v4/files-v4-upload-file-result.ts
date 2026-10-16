import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { SharedV4ProviderReference } from '../../shared/v4/shared-v4-provider-reference';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

/**
 * Result of uploading a file via the files interface.
 */
export type FilesV4UploadFileResult = {
  /**
   * A provider reference mapping provider names to provider-specific file identifiers.
   */
  providerReference: SharedV4ProviderReference;

  /**
   * The IANA media type of the uploaded file, if available from the provider.
   */
  mediaType?: string;

  /**
   * The filename of the uploaded file, if available from the provider.
   */
  filename?: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: SharedV4ProviderMetadata;

  /**
   * Warnings from the provider.
   */
  warnings: Array<SharedV4Warning>;
};
