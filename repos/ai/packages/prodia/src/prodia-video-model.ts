import type {
  Experimental_VideoModelV4,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  downloadBlob,
  parseJSON,
  parseProviderOptions,
  postFormDataToApi,
  postToApi,
  resolve,
  zodSchema,
} from '@ai-sdk/provider-utils';
import {
  buildProdiaProviderMetadata,
  parseMultipart,
  prodiaFailedResponseHandler,
  prodiaJobResultSchema,
  type ProdiaJobResult,
  type ProdiaModelConfig,
} from './prodia-api';
import { prodiaVideoModelOptionsSchema } from './prodia-video-model-options';
import type { ProdiaVideoModelId } from './prodia-video-model-settings';

export class ProdiaVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: ProdiaVideoModelId,
    private readonly config: ProdiaModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const warnings: Array<SharedV4Warning> = [];

    const prodiaOptions = await parseProviderOptions({
      provider: 'prodia',
      providerOptions: options.providerOptions,
      schema: prodiaVideoModelOptionsSchema,
    });

    const jobConfig: Record<string, unknown> = {};

    if (options.prompt !== undefined) {
      jobConfig.prompt = options.prompt;
    }
    if (options.seed !== undefined) {
      jobConfig.seed = options.seed;
    }
    if (prodiaOptions?.resolution !== undefined) {
      jobConfig.resolution = prodiaOptions.resolution;
    }

    const body = {
      type: this.modelId,
      config: jobConfig,
    };

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const combinedHeaders = combineHeaders(
      await resolve(this.config.headers),
      options.headers,
    );

    let multipartResult: {
      jobResult: ProdiaJobResult;
      videoBytes: Uint8Array;
      videoMediaType: string;
    };
    let responseHeaders: Record<string, string> | undefined;

    if (options.image) {
      // img2vid: multipart form-data request
      const imageData = await resolveVideoFileData(
        options.image,
        options.abortSignal,
      );
      const formData = new FormData();
      formData.append(
        'job',
        new Blob([JSON.stringify(body)], { type: 'application/json' }),
        'job.json',
      );
      formData.append(
        'input',
        new Blob([imageData.bytes], { type: imageData.mediaType }),
        'input' + getExtension(imageData.mediaType),
      );

      const result = await postFormDataToApi({
        url: `${this.config.baseURL}/job?price=true`,
        headers: {
          ...combinedHeaders,
          Accept: 'multipart/form-data; video/mp4',
        },
        formData,
        failedResponseHandler: prodiaFailedResponseHandler,
        successfulResponseHandler: createVideoMultipartResponseHandler(),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      multipartResult = result.value;
      responseHeaders = result.responseHeaders;
    } else {
      // txt2vid: JSON request
      const result = await postToApi({
        url: `${this.config.baseURL}/job?price=true`,
        headers: {
          ...combinedHeaders,
          Accept: 'multipart/form-data; video/mp4',
          'Content-Type': 'application/json',
        },
        body: {
          content: JSON.stringify(body),
          values: body,
        },
        failedResponseHandler: prodiaFailedResponseHandler,
        successfulResponseHandler: createVideoMultipartResponseHandler(),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      multipartResult = result.value;
      responseHeaders = result.responseHeaders;
    }

    const { jobResult, videoBytes, videoMediaType } = multipartResult;

    return {
      videos: [
        {
          type: 'binary',
          data: videoBytes,
          mediaType: videoMediaType,
        },
      ],
      warnings,
      providerMetadata: {
        prodia: {
          videos: [buildProdiaProviderMetadata(jobResult)],
        },
      },
      response: {
        modelId: this.modelId,
        timestamp: currentDate,
        headers: responseHeaders,
      },
    };
  }
}

interface VideoMultipartResult {
  jobResult: ProdiaJobResult;
  videoBytes: Uint8Array;
  videoMediaType: string;
}

function createVideoMultipartResponseHandler() {
  return async ({
    response,
  }: {
    response: Response;
  }): Promise<{
    value: VideoMultipartResult;
    responseHeaders: Record<string, string>;
  }> => {
    const contentType = response.headers.get('content-type') ?? '';
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      throw new Error(
        `Prodia response missing multipart boundary in content-type: ${contentType}`,
      );
    }
    const boundary = boundaryMatch[1];

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const parts = parseMultipart(bytes, boundary);

    let jobResult: ProdiaJobResult | undefined;
    let videoBytes: Uint8Array | undefined;
    let videoMediaType = 'video/mp4';

    for (const part of parts) {
      const contentDisposition = part.headers['content-disposition'] ?? '';
      const partContentType = part.headers['content-type'] ?? '';

      if (contentDisposition.includes('name="job"')) {
        const jsonStr = new TextDecoder().decode(part.body);
        jobResult = await parseJSON({
          text: jsonStr,
          schema: zodSchema(prodiaJobResultSchema),
        });
      } else if (contentDisposition.includes('name="output"')) {
        videoBytes = part.body;
        if (partContentType.startsWith('video/')) {
          videoMediaType = partContentType;
        }
      } else if (partContentType.startsWith('video/')) {
        videoBytes = part.body;
        videoMediaType = partContentType;
      }
    }

    if (!jobResult) {
      throw new Error('Prodia multipart response missing job part');
    }
    if (!videoBytes) {
      throw new Error('Prodia multipart response missing output video');
    }

    return {
      value: { jobResult, videoBytes, videoMediaType },
      responseHeaders,
    };
  };
}

async function resolveVideoFileData(
  file: NonNullable<
    Parameters<Experimental_VideoModelV4['doGenerate']>[0]['image']
  >,
  abortSignal?: AbortSignal,
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  if (file.type === 'file') {
    const data =
      typeof file.data === 'string'
        ? convertBase64ToUint8Array(file.data)
        : file.data;
    return { bytes: data, mediaType: file.mediaType };
  }
  // URL type - download via downloadBlob so the user-supplied URL is routed
  // through the SSRF guard (validateDownloadUrl) instead of being fetched
  // directly, preventing requests to private/internal addresses.
  const blob = await downloadBlob(file.url, { abortSignal });
  const arrayBuffer = await blob.arrayBuffer();
  const mediaType = blob.type || 'application/octet-stream';
  return { bytes: new Uint8Array(arrayBuffer), mediaType };
}

function getExtension(mediaType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[mediaType] ?? '';
}
