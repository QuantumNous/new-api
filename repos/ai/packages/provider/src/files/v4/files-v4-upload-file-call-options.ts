import type {
  SharedV4FileDataData,
  SharedV4FileDataText,
} from '../../shared/v4/shared-v4-file-data';
import type { SharedV4ProviderOptions } from '../../shared/v4/shared-v4-provider-options';

/**
 * Options for uploading a file via the files interface.
 */
export type FilesV4UploadFileCallOptions = {
  /**
   * The file data.
   *
   * - `{ type: 'data', data }`: raw bytes (`Uint8Array`) or a base64-encoded string.
   * - `{ type: 'text', text }`: inline text (UTF-8).
   */
  data: SharedV4FileDataData | SharedV4FileDataText;

  /**
   * The IANA media type of the file (e.g. `'application/pdf'`).
   */
  mediaType: string;

  /**
   * The filename of the file.
   */
  filename?: string;

  /**
   * Additional provider-specific options. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: SharedV4ProviderOptions;
};
