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
import { xaiFailedResponseHandler } from '../xai-error';
import { xaiFilesResponseSchema } from './xai-files-api';
import {
  xaiFilesOptionsSchema,
  type XaiFilesOptions,
} from './xai-files-options';
interface XaiFilesConfig {
  provider: string;
  baseURL: string | undefined;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
}

export class XaiFiles implements FilesV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  constructor(private readonly config: XaiFilesConfig) {}

  async uploadFile({
    data,
    mediaType,
    filename,
    providerOptions,
  }: FilesV4UploadFileCallOptions): Promise<FilesV4UploadFileResult> {
    const xaiOptions = (await parseProviderOptions({
      provider: 'xai',
      providerOptions,
      schema: xaiFilesOptionsSchema,
    })) as XaiFilesOptions | undefined;

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

    if (xaiOptions?.teamId != null) {
      formData.append('team_id', xaiOptions.teamId);
    }

    const { value: response } = await postFormDataToApi({
      url: `${this.config.baseURL}/files`,
      headers: combineHeaders(this.config.headers()),
      formData,
      failedResponseHandler: xaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        xaiFilesResponseSchema,
      ),
      fetch: this.config.fetch,
    });

    return {
      warnings: [],
      providerReference: { xai: response.id },
      ...((response.filename ?? filename)
        ? { filename: response.filename ?? filename }
        : {}),
      ...(mediaType != null ? { mediaType } : {}),
      providerMetadata: {
        xai: {
          ...(response.filename != null ? { filename: response.filename } : {}),
          ...(response.bytes != null ? { bytes: response.bytes } : {}),
          ...(response.created_at != null
            ? { createdAt: response.created_at }
            : {}),
        },
      },
    };
  }
}
