import type { ImageModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  parseJSON,
  parseProviderOptions,
  postToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
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
import { prodiaImageModelOptionsSchema } from './prodia-image-model-options';
import type { ProdiaImageModelId } from './prodia-image-settings';

export class ProdiaImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: ProdiaImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: ProdiaImageModelId;
    config: ProdiaModelConfig;
  }) {
    return new ProdiaImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: ProdiaImageModelId,
    private readonly config: ProdiaModelConfig,
  ) {}

  private async getArgs({
    prompt,
    size,
    seed,
    providerOptions,
  }: Parameters<ImageModelV4['doGenerate']>[0]) {
    const warnings: Array<SharedV4Warning> = [];

    const prodiaOptions = await parseProviderOptions({
      provider: 'prodia',
      providerOptions,
      schema: prodiaImageModelOptionsSchema,
    });

    let width: number | undefined;
    let height: number | undefined;
    if (size) {
      const [widthStr, heightStr] = size.split('x');
      width = Number(widthStr);
      height = Number(heightStr);
      if (
        !widthStr ||
        !heightStr ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        warnings.push({
          type: 'unsupported',
          feature: 'size',
          details: `Invalid size format: ${size}. Expected format: WIDTHxHEIGHT (e.g., 1024x1024)`,
        });
        width = undefined;
        height = undefined;
      }
    }

    const jobConfig: Record<string, unknown> = {
      prompt,
    };

    if (prodiaOptions?.width !== undefined) {
      jobConfig.width = prodiaOptions.width;
    } else if (width !== undefined) {
      jobConfig.width = width;
    }

    if (prodiaOptions?.height !== undefined) {
      jobConfig.height = prodiaOptions.height;
    } else if (height !== undefined) {
      jobConfig.height = height;
    }

    if (seed !== undefined) {
      jobConfig.seed = seed;
    }
    if (prodiaOptions?.steps !== undefined) {
      jobConfig.steps = prodiaOptions.steps;
    }
    if (prodiaOptions?.stylePreset !== undefined) {
      jobConfig.style_preset = prodiaOptions.stylePreset;
    }
    if (prodiaOptions?.loras !== undefined && prodiaOptions.loras.length > 0) {
      jobConfig.loras = prodiaOptions.loras;
    }
    if (prodiaOptions?.progressive !== undefined) {
      jobConfig.progressive = prodiaOptions.progressive;
    }

    const body = {
      type: this.modelId,
      config: jobConfig,
    };

    return { body, warnings };
  }

  async doGenerate(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    const { body, warnings } = await this.getArgs(options);

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const combinedHeaders = combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      options.headers,
    );

    const { value: multipartResult, responseHeaders } = await postToApi({
      url: `${this.config.baseURL}/job?price=true`,
      headers: {
        ...combinedHeaders,
        Accept: 'multipart/form-data; image/png',
        'Content-Type': 'application/json',
      },
      body: {
        content: JSON.stringify(body),
        values: body,
      },
      failedResponseHandler: prodiaFailedResponseHandler,
      successfulResponseHandler: createMultipartResponseHandler(),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const { jobResult, imageBytes } = multipartResult;

    return {
      images: [imageBytes],
      warnings,
      providerMetadata: {
        prodia: {
          images: [buildProdiaProviderMetadata(jobResult)],
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

interface MultipartResult {
  jobResult: ProdiaJobResult;
  imageBytes: Uint8Array;
}

function createMultipartResponseHandler() {
  return async ({
    response,
  }: {
    response: Response;
  }): Promise<{
    value: MultipartResult;
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
    let imageBytes: Uint8Array | undefined;

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
        imageBytes = part.body;
      } else if (partContentType.startsWith('image/')) {
        imageBytes = part.body;
      }
    }

    if (!jobResult) {
      throw new Error('Prodia multipart response missing job part');
    }
    if (!imageBytes) {
      throw new Error('Prodia multipart response missing output image');
    }

    return {
      value: { jobResult, imageBytes },
      responseHeaders,
    };
  };
}
