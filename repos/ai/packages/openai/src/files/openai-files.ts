import type {
  FilesV4,
  FilesV4UploadFileCallOptions,
  FilesV4UploadFileResult,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertInlineFileDataToUint8Array,
  createJsonResponseHandler,
  parseProviderOptions,
  postFormDataToApi,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { openaiFailedResponseHandler } from '../openai-error';
import { openaiFilesResponseSchema } from './openai-files-api';
import {
  openaiFilesOptionsSchema,
  type OpenAIFilesOptions,
} from './openai-files-options';
interface OpenAIFilesConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
}

export class OpenAIFiles implements FilesV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  constructor(private readonly config: OpenAIFilesConfig) {}

  async uploadFile({
    data,
    mediaType,
    filename,
    providerOptions,
  }: FilesV4UploadFileCallOptions): Promise<FilesV4UploadFileResult> {
    const openaiOptions = (await parseProviderOptions({
      provider: 'openai',
      providerOptions,
      schema: openaiFilesOptionsSchema,
    })) as OpenAIFilesOptions | undefined;

    const fileBytes = convertInlineFileDataToUint8Array(data);

    const blob = new Blob([fileBytes], {
      type: mediaType,
    });

    const formData = new FormData();
    if (filename != null) {
      formData.append('file', blob, filename);
    } else {
      formData.append('file', blob);
    }
    formData.append('purpose', openaiOptions?.purpose ?? 'assistants');

    if (openaiOptions?.expiresAfter != null) {
      formData.append('expires_after', String(openaiOptions.expiresAfter));
    }

    const { value: response } = await postFormDataToApi({
      url: `${this.config.baseURL}/files`,
      headers: combineHeaders(this.config.headers()),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiFilesResponseSchema,
      ),
      fetch: this.config.fetch,
    });

    return {
      warnings: [],
      providerReference: { openai: response.id },
      ...((response.filename ?? filename)
        ? { filename: response.filename ?? filename }
        : {}),
      ...(mediaType != null ? { mediaType } : {}),
      providerMetadata: {
        openai: {
          ...(response.filename != null ? { filename: response.filename } : {}),
          ...(response.purpose != null ? { purpose: response.purpose } : {}),
          ...(response.bytes != null ? { bytes: response.bytes } : {}),
          ...(response.created_at != null
            ? { createdAt: response.created_at }
            : {}),
          ...(response.status != null ? { status: response.status } : {}),
          ...(response.expires_at != null
            ? { expiresAt: response.expires_at }
            : {}),
        },
      },
    };
  }
}
