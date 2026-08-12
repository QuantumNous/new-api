import type {
  FilesV4,
  FilesV4UploadFileCallOptions,
  ProviderV4,
} from '@ai-sdk/provider';
import {
  convertBase64ToUint8Array,
  detectMediaType,
} from '@ai-sdk/provider-utils';
import type { ProviderMetadata } from '../types/provider-metadata';
import type { ProviderReference } from '../types/provider-reference';
import type { Warning } from '../types/warning';
import type { UploadFileResult } from './upload-file-result';

/**
 * Uploads a file using a files API interface.
 *
 * @param api - The Files API interface to use for uploading.
 * @param data - The file data to upload (tagged `{ type: 'data' | 'text' }`).
 * @param mediaType - Optional IANA media type. Auto-detected from file bytes
 * when omitted (falls back to `text/plain` for the `text` variant).
 * @param filename - Optional filename for the uploaded file.
 * @param providerOptions - Additional provider-specific options.
 *
 * @returns A result object containing the provider reference and optional metadata.
 */
export async function uploadFile({
  api,
  data: dataArg,
  mediaType: mediaTypeArg,
  filename,
  providerOptions,
}: {
  /**
   * The files API interface to use for uploading.
   * Can be a `FilesV4` instance or a `ProviderV4` instance with a `files()` method.
   */
  api: FilesV4 | ProviderV4;
} & Omit<FilesV4UploadFileCallOptions, 'mediaType' | 'data'> & {
    /**
     * The file data. Accepts the tagged `{ type: 'data' | 'text' }` shapes, or
     * the shorthand `Uint8Array | string` (treated as `{ type: 'data', data }`).
     */
    data: FilesV4UploadFileCallOptions['data'] | Uint8Array | string;

    /**
     * Optional IANA media type of the file. Auto-detected from file bytes when
     * omitted; falls back to `text/plain` for the `text` variant.
     */
    mediaType?: string;
  }): Promise<UploadFileResult> {
  const data: FilesV4UploadFileCallOptions['data'] =
    dataArg instanceof Uint8Array || typeof dataArg === 'string'
      ? { type: 'data', data: dataArg }
      : dataArg;

  const mediaType =
    mediaTypeArg ??
    (data.type === 'text'
      ? 'text/plain'
      : (detectMediaType({ data: data.data }) ??
        (isLikelyText(data.data) ? 'text/plain' : 'application/octet-stream')));

  const filesApi: FilesV4 =
    'uploadFile' in api
      ? api
      : typeof api.files === 'function'
        ? api.files()
        : (() => {
            throw new Error(
              'The provider does not support file uploads. Make sure it exposes a files() method.',
            );
          })();

  const result = await filesApi.uploadFile({
    data,
    mediaType,
    filename,
    providerOptions,
  });

  return new DefaultUploadFileResult({
    providerReference: result.providerReference,
    mediaType: result.mediaType,
    filename: result.filename,
    providerMetadata: result.providerMetadata,
    warnings: result.warnings,
  });
}

class DefaultUploadFileResult implements UploadFileResult {
  readonly providerReference: ProviderReference;
  readonly mediaType?: string;
  readonly filename?: string;
  readonly providerMetadata?: ProviderMetadata;
  readonly warnings: Array<Warning>;

  constructor(options: {
    providerReference: ProviderReference;
    mediaType?: string;
    filename?: string;
    providerMetadata?: ProviderMetadata;
    warnings: Array<Warning>;
  }) {
    this.providerReference = options.providerReference;
    this.mediaType = options.mediaType;
    this.filename = options.filename;
    this.providerMetadata = options.providerMetadata;
    this.warnings = options.warnings;
  }
}

function isLikelyText(data: Uint8Array | string): boolean {
  /*
   * Limit checks to 512 bytes for performance.
   * 4 base64 characters represent 3 bytes, and we use a small margin of 4 bytes just to be safe.
   */
  const CHECK_LENGTH = 512;
  const BASE64_CHECK_LENGTH = Math.ceil((CHECK_LENGTH + 4) / 3) * 4;

  const bytes =
    typeof data === 'string'
      ? convertBase64ToUint8Array(
          data.substring(0, Math.min(data.length, BASE64_CHECK_LENGTH)),
        )
      : data;

  const checkLength = Math.min(bytes.length, CHECK_LENGTH);
  if (checkLength === 0) return false;

  for (let i = 0; i < checkLength; i++) {
    const byte = bytes[i];
    if (
      byte === 0x00 ||
      (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)
    ) {
      return false;
    }
  }
  return true;
}
