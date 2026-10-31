import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { openaiFailedResponseHandler } from '../openai-error';
import { throwIfOpenAIStreamErrorBeforeOutput } from '../openai-stream-error';
import {
  convertOpenAICompletionUsage,
  type OpenAICompletionUsage,
} from './convert-openai-completion-usage';
import { convertToOpenAICompletionPrompt } from './convert-to-openai-completion-prompt';
import { getResponseMetadata } from './get-response-metadata';
import { mapOpenAIFinishReason } from './map-openai-finish-reason';
import {
  openaiCompletionChunkSchema,
  openaiCompletionResponseSchema,
  type OpenAICompletionChunk,
} from './openai-completion-api';
import {
  openaiLanguageModelCompletionOptions,
  type OpenAICompletionModelId,
} from './openai-completion-language-model-options';
type OpenAICompletionConfig = {
  provider: string;
  headers?: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
};

export class OpenAICompletionLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: OpenAICompletionModelId;

  private readonly config: OpenAICompletionConfig;

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim();
  }

  static [WORKFLOW_SERIALIZE](model: OpenAICompletionLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: OpenAICompletionModelId;
    config: OpenAICompletionConfig;
  }) {
    return new OpenAICompletionLanguageModel(options.modelId, options.config);
  }

  constructor(
    modelId: OpenAICompletionModelId,
    config: OpenAICompletionConfig,
  ) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    // No URLs are supported for completion models.
  };

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    tools,
    toolChoice,
    seed,
    providerOptions,
  }: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const openaiOptions = {
      ...(await parseProviderOptions({
        provider: 'openai',
        providerOptions,
        schema: openaiLanguageModelCompletionOptions,
      })),
      ...(await parseProviderOptions({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiLanguageModelCompletionOptions,
      })),
    };

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (tools?.length) {
      warnings.push({ type: 'unsupported', feature: 'tools' });
    }

    if (toolChoice != null) {
      warnings.push({ type: 'unsupported', feature: 'toolChoice' });
    }

    if (responseFormat != null && responseFormat.type !== 'text') {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details: 'JSON response format is not supported.',
      });
    }

    const { prompt: completionPrompt, stopSequences } =
      convertToOpenAICompletionPrompt({ prompt });

    const stop = [...(stopSequences ?? []), ...(userStopSequences ?? [])];

    return {
      args: {
        // model id:
        model: this.modelId,

        // model specific settings:
        echo: openaiOptions.echo,
        logit_bias: openaiOptions.logitBias,
        logprobs:
          openaiOptions?.logprobs === true
            ? 0
            : openaiOptions?.logprobs === false
              ? undefined
              : openaiOptions?.logprobs,
        suffix: openaiOptions.suffix,
        user: openaiOptions.user,

        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,

        // prompt:
        prompt: completionPrompt,

        // stop sequences:
        stop: stop.length > 0 ? stop : undefined,
      },
      warnings,
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: args,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiCompletionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const choice = response.choices[0];

    const providerMetadata: SharedV4ProviderMetadata = { openai: {} };

    if (choice.logprobs != null) {
      providerMetadata.openai.logprobs = choice.logprobs;
    }

    return {
      content: [{ type: 'text', text: choice.text }],
      usage: convertOpenAICompletionUsage(response.usage),
      finishReason: {
        unified: mapOpenAIFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined,
      },
      request: { body: args },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      providerMetadata,
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings } = await this.getArgs(options);

    const body = {
      ...args,
      stream: true,

      stream_options: {
        include_usage: true,
      },
    };

    const url = this.config.url({
      path: '/completions',
      modelId: this.modelId,
    });

    const { responseHeaders, value: response } = await postJsonToApi({
      url,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        openaiCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const checkedResponse = await throwIfOpenAIStreamErrorBeforeOutput({
      stream: response,
      getError: chunk => ('error' in chunk ? chunk.error : undefined),
      isOutputChunk: isOpenAICompletionOutputChunk,
      url,
      requestBodyValues: body,
      responseHeaders,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    const providerMetadata: SharedV4ProviderMetadata = { openai: {} };
    let usage: OpenAICompletionUsage | undefined = undefined;
    let isFirstChunk = true;

    const result = {
      stream: checkedResponse.pipeThrough(
        new TransformStream<
          ParseResult<OpenAICompletionChunk>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            if (isFirstChunk) {
              isFirstChunk = false;

              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });

              controller.enqueue({ type: 'text-start', id: '0' });
            }

            if (value.usage != null) {
              usage = value.usage;
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapOpenAIFinishReason(choice.finish_reason),
                raw: choice.finish_reason,
              };
            }

            if (choice?.logprobs != null) {
              providerMetadata.openai.logprobs = choice.logprobs;
            }

            if (choice?.text != null && choice.text.length > 0) {
              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: choice.text,
              });
            }
          },

          flush(controller) {
            if (!isFirstChunk) {
              controller.enqueue({ type: 'text-end', id: '0' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              providerMetadata,
              usage: convertOpenAICompletionUsage(usage),
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };

    return result;
  }
}

function isOpenAICompletionOutputChunk(chunk: OpenAICompletionChunk): boolean {
  return (
    !('error' in chunk) && chunk.choices.some(choice => choice.text.length > 0)
  );
}
