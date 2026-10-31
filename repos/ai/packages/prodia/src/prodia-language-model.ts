import {
  UnsupportedFunctionalityError,
  type LanguageModelV4,
  type LanguageModelV4CallOptions,
  type LanguageModelV4Content,
  type LanguageModelV4StreamPart,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  isCustomReasoning,
  convertBase64ToUint8Array,
  detectMediaType,
  generateId,
  getTopLevelMediaType,
  isFullMediaType,
  parseJSON,
  parseProviderOptions,
  postFormDataToApi,
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
import { prodiaLanguageModelOptionsSchema } from './prodia-language-model-options';
import type { ProdiaLanguageModelId } from './prodia-language-model-settings';

export class ProdiaLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';
  readonly supportedUrls = {};

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: ProdiaLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: ProdiaLanguageModelId;
    config: ProdiaModelConfig;
  }) {
    return new ProdiaLanguageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: ProdiaLanguageModelId,
    private readonly config: ProdiaModelConfig,
  ) {}

  async doGenerate(options: LanguageModelV4CallOptions) {
    const warnings: Array<SharedV4Warning> = [];

    // Warn about unsupported LLM features
    if (options.temperature !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'temperature' });
    }
    if (options.topP !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'topP' });
    }
    if (options.topK !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }
    if (options.maxOutputTokens !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'maxOutputTokens' });
    }
    if (options.stopSequences !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'stopSequences' });
    }
    if (options.presencePenalty !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'presencePenalty' });
    }
    if (options.frequencyPenalty !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'frequencyPenalty' });
    }
    if (options.tools !== undefined && options.tools.length > 0) {
      warnings.push({ type: 'unsupported', feature: 'tools' });
    }
    if (options.toolChoice !== undefined) {
      warnings.push({ type: 'unsupported', feature: 'toolChoice' });
    }
    if (
      options.responseFormat !== undefined &&
      options.responseFormat.type !== 'text'
    ) {
      warnings.push({ type: 'unsupported', feature: 'responseFormat' });
    }

    if (isCustomReasoning(options.reasoning)) {
      warnings.push({
        type: 'unsupported',
        feature: 'reasoning',
        details: 'This provider does not support reasoning configuration.',
      });
    }

    const prodiaOptions = await parseProviderOptions({
      provider: 'prodia',
      providerOptions: options.providerOptions,
      schema: prodiaLanguageModelOptionsSchema,
    });

    // Extract text prompt from messages
    let prompt = '';
    let systemMessage = '';
    for (const message of options.prompt) {
      if (message.role === 'system') {
        systemMessage = message.content;
      }
    }
    // Get text from the last user message
    for (let i = options.prompt.length - 1; i >= 0; i--) {
      const message = options.prompt[i];
      if (message.role === 'user') {
        for (const part of message.content) {
          if (part.type === 'text') {
            prompt += (prompt ? '\n' : '') + part.text;
          }
        }
        break;
      }
    }
    if (systemMessage) {
      prompt = systemMessage + '\n' + prompt;
    }

    // Extract image from user messages
    let imageBytes: Uint8Array | undefined;
    let imageMediaType = 'image/png';
    for (let i = options.prompt.length - 1; i >= 0; i--) {
      const message = options.prompt[i];
      if (message.role === 'user') {
        for (const part of message.content) {
          if (
            part.type === 'file' &&
            getTopLevelMediaType(part.mediaType) === 'image'
          ) {
            switch (part.data.type) {
              case 'reference': {
                throw new UnsupportedFunctionalityError({
                  functionality: 'file parts with provider references',
                });
              }
              case 'text': {
                throw new UnsupportedFunctionalityError({
                  functionality: 'text file parts',
                });
              }
              case 'data': {
                if (part.data.data instanceof Uint8Array) {
                  imageBytes = part.data.data;
                } else {
                  imageBytes = convertBase64ToUint8Array(part.data.data);
                }
                break;
              }
              case 'url': {
                const fetchFn = this.config.fetch ?? globalThis.fetch;
                const response = await fetchFn(part.data.url.toString());
                const arrayBuffer = await response.arrayBuffer();
                imageBytes = new Uint8Array(arrayBuffer);
                break;
              }
            }
            if (isFullMediaType(part.mediaType)) {
              imageMediaType = part.mediaType;
            } else if (imageBytes !== undefined) {
              const detected = detectMediaType({
                data: imageBytes,
                topLevelType: getTopLevelMediaType(part.mediaType),
              });
              if (detected !== undefined) {
                imageMediaType = detected;
              }
            }
            break;
          }
        }
        break;
      }
    }

    const jobConfig: Record<string, unknown> = {
      prompt,
      include_messages: true,
    };

    if (prodiaOptions?.aspectRatio !== undefined) {
      jobConfig.aspect_ratio = prodiaOptions.aspectRatio;
    }

    const body = {
      type: this.modelId,
      config: jobConfig,
    };

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const combinedHeaders = combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      options.headers,
    );

    // Always use multipart form-data since img2img requires image input
    const formData = new FormData();
    formData.append(
      'job',
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
      'job.json',
    );
    if (imageBytes) {
      const fileExtension =
        imageMediaType === 'image/png'
          ? '.png'
          : imageMediaType === 'image/jpeg'
            ? '.jpg'
            : imageMediaType === 'image/webp'
              ? '.webp'
              : '';
      formData.append(
        'input',
        new Blob([imageBytes], { type: imageMediaType }),
        'input' + fileExtension,
      );
    }

    const { value: multipartResult, responseHeaders } = await postFormDataToApi(
      {
        url: `${this.config.baseURL}/job?price=true`,
        headers: {
          ...combinedHeaders,
          Accept: 'multipart/form-data',
        },
        formData,
        failedResponseHandler: prodiaFailedResponseHandler,
        successfulResponseHandler: createLanguageMultipartResponseHandler(),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      },
    );

    const { jobResult, textContent, fileContent } = multipartResult;

    const content: Array<LanguageModelV4Content> = [];
    if (textContent !== undefined) {
      content.push({ type: 'text', text: textContent });
    }
    for (const file of fileContent) {
      content.push({
        type: 'file',
        mediaType: file.mediaType,
        data: { type: 'data', data: file.data },
      });
    }

    return {
      content,
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: undefined,
          text: undefined,
          reasoning: undefined,
        },
      },
      warnings,
      providerMetadata: {
        prodia: buildProdiaProviderMetadata(jobResult),
      },
      response: {
        modelId: this.modelId,
        timestamp: currentDate,
        headers: responseHeaders,
      },
    };
  }

  async doStream(options: LanguageModelV4CallOptions) {
    const result = await this.doGenerate(options);

    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      start(controller) {
        controller.enqueue({
          type: 'stream-start',
          warnings: result.warnings,
        });

        controller.enqueue({
          type: 'response-metadata',
          modelId: result.response?.modelId,
          timestamp: result.response?.timestamp,
        });

        for (const part of result.content) {
          if (part.type === 'text') {
            const id = generateId();
            controller.enqueue({ type: 'text-start', id });
            controller.enqueue({
              type: 'text-delta',
              id,
              delta: part.text,
            });
            controller.enqueue({ type: 'text-end', id });
          } else if (part.type === 'file') {
            controller.enqueue({
              type: 'file',
              mediaType: part.mediaType,
              data: part.data,
            });
          }
        }

        controller.enqueue({
          type: 'finish',
          usage: result.usage,
          finishReason: result.finishReason,
          providerMetadata: result.providerMetadata,
        });

        controller.close();
      },
    });

    return {
      stream,
      response: {
        headers: result.response?.headers,
      },
    };
  }
}

interface LanguageMultipartResult {
  jobResult: ProdiaJobResult;
  textContent: string | undefined;
  fileContent: Array<{ mediaType: string; data: Uint8Array }>;
}

function createLanguageMultipartResponseHandler() {
  return async ({
    response,
  }: {
    response: Response;
  }): Promise<{
    value: LanguageMultipartResult;
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
    let textContent: string | undefined;
    const fileContent: Array<{ mediaType: string; data: Uint8Array }> = [];

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
        if (
          partContentType.startsWith('text/') ||
          contentDisposition.includes('.txt')
        ) {
          textContent = new TextDecoder().decode(part.body);
        } else if (partContentType.startsWith('image/')) {
          fileContent.push({
            mediaType: partContentType,
            data: part.body,
          });
        }
      }
    }

    if (!jobResult) {
      throw new Error('Prodia multipart response missing job part');
    }

    return {
      value: { jobResult, textContent, fileContent },
      responseHeaders,
    };
  };
}
