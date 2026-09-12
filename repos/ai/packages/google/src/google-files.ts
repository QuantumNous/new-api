import {
  AISDKError,
  type FilesV4,
  type FilesV4UploadFileCallOptions,
  type FilesV4UploadFileResult,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertInlineFileDataToUint8Array,
  createJsonResponseHandler,
  delay,
  lazySchema,
  parseProviderOptions,
  zodSchema,
  getFromApi,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { googleFailedResponseHandler } from './google-error';

export type GoogleFilesUploadOptions = {
  displayName?: string | null;
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;

  [key: string]: unknown;
};

interface GoogleFilesConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
}

export class GoogleFiles implements FilesV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  constructor(private readonly config: GoogleFilesConfig) {}

  async uploadFile(
    options: FilesV4UploadFileCallOptions,
  ): Promise<FilesV4UploadFileResult> {
    const googleOptions = (await parseProviderOptions({
      provider: 'google',
      providerOptions: options.providerOptions,
      schema: googleFilesUploadOptionsSchema,
    })) as GoogleFilesUploadOptions | undefined;

    const resolvedHeaders = this.config.headers();
    const fetchFn = this.config.fetch ?? globalThis.fetch;

    const warnings: Array<SharedV4Warning> = [];
    if (options.filename != null) {
      warnings.push({ type: 'unsupported', feature: 'filename' });
    }

    const fileBytes = convertInlineFileDataToUint8Array(options.data);

    const mediaType = options.mediaType;
    const displayName = googleOptions?.displayName;

    const baseOrigin = this.config.baseURL.replace(/\/v1beta$/, '');

    const initResponse = await fetchFn(`${baseOrigin}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        ...resolvedHeaders,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(fileBytes.length),
        'X-Goog-Upload-Header-Content-Type': mediaType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          ...(displayName != null ? { display_name: displayName } : {}),
        },
      }),
    });

    if (!initResponse.ok) {
      const errorBody = await initResponse.text();
      throw new AISDKError({
        name: 'GOOGLE_FILES_UPLOAD_ERROR',
        message: `Failed to initiate resumable upload: ${initResponse.status} ${errorBody}`,
      });
    }

    const uploadUrl = initResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new AISDKError({
        name: 'GOOGLE_FILES_UPLOAD_ERROR',
        message: 'No upload URL returned from initiation request',
      });
    }

    const uploadResponse = await fetchFn(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(fileBytes.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: fileBytes,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      throw new AISDKError({
        name: 'GOOGLE_FILES_UPLOAD_ERROR',
        message: `Failed to upload file data: ${uploadResponse.status} ${errorBody}`,
      });
    }

    const uploadResult = (await uploadResponse.json()) as {
      file: GoogleFileResource;
    };

    let file = uploadResult.file;

    const pollIntervalMs = googleOptions?.pollIntervalMs ?? 2000;
    const pollTimeoutMs = googleOptions?.pollTimeoutMs ?? 300000;
    const startTime = Date.now();

    while (file.state === 'PROCESSING') {
      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'GOOGLE_FILES_UPLOAD_TIMEOUT',
          message: `File processing timed out after ${pollTimeoutMs}ms`,
        });
      }

      await delay(pollIntervalMs);

      const { value: fileStatus } = await getFromApi({
        url: `${this.config.baseURL}/${file.name}`,
        validateUrl: false,
        headers: combineHeaders(resolvedHeaders),
        successfulResponseHandler: createJsonResponseHandler(
          googleFileResponseSchema,
        ),
        failedResponseHandler: googleFailedResponseHandler,
        fetch: this.config.fetch,
      });

      file = fileStatus;
    }

    if (file.state === 'FAILED') {
      throw new AISDKError({
        name: 'GOOGLE_FILES_UPLOAD_FAILED',
        message: `File processing failed for ${file.name}`,
      });
    }

    return {
      warnings,
      providerReference: { google: file.uri },
      mediaType: file.mimeType ?? options.mediaType,
      providerMetadata: {
        google: {
          name: file.name,
          displayName: file.displayName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          state: file.state,
          uri: file.uri,
          ...(file.createTime != null ? { createTime: file.createTime } : {}),
          ...(file.updateTime != null ? { updateTime: file.updateTime } : {}),
          ...(file.expirationTime != null
            ? { expirationTime: file.expirationTime }
            : {}),
          ...(file.sha256Hash != null ? { sha256Hash: file.sha256Hash } : {}),
        },
      },
    };
  }
}

type GoogleFileResource = {
  name: string;
  displayName?: string | null;
  mimeType: string;
  sizeBytes?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  expirationTime?: string | null;
  sha256Hash?: string | null;
  uri: string;
  state: string;
};

const googleFileResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      name: z.string(),
      displayName: z.string().nullish(),
      mimeType: z.string(),
      sizeBytes: z.string().nullish(),
      createTime: z.string().nullish(),
      updateTime: z.string().nullish(),
      expirationTime: z.string().nullish(),
      sha256Hash: z.string().nullish(),
      uri: z.string(),
      state: z.string(),
    }),
  ),
);

const googleFilesUploadOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      displayName: z.string().nullish(),
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),
    }),
  ),
);
