import type {
  JSONValue,
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  createIdGenerator,
  DelayedPromise,
  type InferSchema,
  type FlexibleSchema,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import type { ServerResponse } from 'http';
import { logWarnings } from '../logger/log-warnings';
import { resolveLanguageModel } from '../model/resolve-model';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import { prepareLanguageModelCallOptions } from '../prompt/prepare-language-model-call-options';
import type { RequestOptions } from '../prompt/request-options';
import { convertToLanguageModelPrompt } from '../prompt/convert-to-language-model-prompt';
import type { Prompt } from '../prompt/prompt';
import { standardizePrompt } from '../prompt/standardize-prompt';
import { wrapGatewayError } from '../prompt/wrap-gateway-error';
import { createTelemetryDispatcher } from '../telemetry/create-telemetry-dispatcher';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import { createTextStreamResponse } from '../text-stream/create-text-stream-response';
import { pipeTextStreamToResponse } from '../text-stream/pipe-text-stream-to-response';
import type {
  CallWarning,
  FinishReason,
  LanguageModel,
} from '../types/language-model';
import type { LanguageModelRequestMetadata } from '../types/language-model-request-metadata';
import type { LanguageModelResponseMetadata } from '../types/language-model-response-metadata';
import type { ProviderMetadata } from '../types/provider-metadata';
import {
  asLanguageModelUsage,
  createNullLanguageModelUsage,
  type LanguageModelUsage,
} from '../types/usage';
import { isDeepEqualData, parsePartialJson, type DeepPartial } from '../util';
import {
  createAsyncIterableStream,
  type AsyncIterableStream,
} from '../util/async-iterable-stream';
import type { Callback } from '../util/callback';
import { createStitchableStream } from '../util/create-stitchable-stream';
import type { DownloadFunction } from '../util/download/download-function';
import { notify } from '../util/notify';
import { now as originalNow } from '../util/now';
import { prepareRetries } from '../util/prepare-retries';
import type {
  GenerateObjectEndEvent,
  GenerateObjectStartEvent,
  GenerateObjectStepEndEvent,
  GenerateObjectStepStartEvent,
} from './structured-output-events';
import { getOutputStrategy, type OutputStrategy } from './output-strategy';
import { parseAndValidateObjectResultWithRepair } from './parse-and-validate-object-result';
import type { RepairTextFunction } from './repair-text';
import type {
  ObjectStreamPart,
  StreamObjectResult,
} from './stream-object-result';
import { validateObjectGenerationInput } from './validate-object-generation-input';

const originalGenerateId = createIdGenerator({ prefix: 'aiobj', size: 24 });

/**
 * Callback that is set using the `onError` option.
 *
 * @param event - The event that is passed to the callback.
 */
export type StreamObjectOnErrorCallback = (event: {
  error: unknown;
}) => Promise<void> | void;

/**
 * Callback that is set using the `onFinish` option.
 *
 * @param event - The event that is passed to the callback.
 */
export type StreamObjectOnFinishCallback<RESULT> = (event: {
  /**
   * The token usage of the generated response.
   */
  usage: LanguageModelUsage;

  /**
   * The generated object. Can be undefined if the final object does not match the schema.
   */
  object: RESULT | undefined;

  /**
   * Optional error object. This is e.g. a TypeValidationError when the final object does not match the schema.
   */
  error: unknown | undefined;

  /**
   * Response metadata.
   */
  response: LanguageModelResponseMetadata;

  /**
   * Warnings from the model provider (e.g. unsupported settings).
   */
  warnings?: CallWarning[];

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata: ProviderMetadata | undefined;
}) => Promise<void> | void;

/**
 * Generate a structured, typed object for a given prompt and schema using a language model.
 *
 * This function streams the output. If you do not want to stream the output, use `generateObject` instead.
 *
 * @param model - The language model to use.
 *
 * @param system - A system message that will be part of the prompt.
 * @param prompt - A simple text prompt. You can either use `prompt` or `messages` but not both.
 * @param messages - A list of messages. You can either use `prompt` or `messages` but not both.
 * @param allowSystemInMessages - Whether system messages are allowed in the `prompt` or `messages` fields. Default: false.
 *
 * @param maxOutputTokens - Maximum number of tokens to generate.
 * @param temperature - Temperature setting.
 * The value is passed through to the provider. The range depends on the provider and model.
 * It is recommended to set either `temperature` or `topP`, but not both.
 * @param topP - Nucleus sampling.
 * The value is passed through to the provider. The range depends on the provider and model.
 * It is recommended to set either `temperature` or `topP`, but not both.
 * @param topK - Only sample from the top K options for each subsequent token.
 * Used to remove "long tail" low probability responses.
 * Recommended for advanced use cases only. You usually only need to use temperature.
 * @param presencePenalty - Presence penalty setting.
 * It affects the likelihood of the model to repeat information that is already in the prompt.
 * The value is passed through to the provider. The range depends on the provider and model.
 * @param frequencyPenalty - Frequency penalty setting.
 * It affects the likelihood of the model to repeatedly use the same words or phrases.
 * The value is passed through to the provider. The range depends on the provider and model.
 * @param stopSequences - Stop sequences.
 * If set, the model will stop generating text when one of the stop sequences is generated.
 * @param seed - The seed (integer) to use for random sampling.
 * If set and supported by the model, calls will generate deterministic results.
 *
 * @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.
 *
 * @param schema - The schema of the object that the model should generate.
 * @param schemaName - Optional name of the output that should be generated.
 * Used by some providers for additional LLM guidance, e.g.
 * via tool or schema name.
 * @param schemaDescription - Optional description of the output that should be generated.
 * Used by some providers for additional LLM guidance, e.g.
 * via tool or schema description.
 *
 * @param output - The type of the output.
 *
 * - 'object': The output is an object.
 * - 'array': The output is an array.
 * - 'enum': The output is an enum.
 * - 'no-schema': The output is not a schema.
 *
 * @param telemetry - Optional telemetry configuration.
 *
 * @param providerOptions - Additional provider-specific options. They are passed through
 * to the provider from the AI SDK and enable provider-specific
 * functionality that can be fully encapsulated in the provider.
 *
 * @returns
 * A result object for accessing the partial object stream and additional information.
 *
 * @deprecated Use `streamText` with an `output` setting instead.
 */
export function streamObject<
  SCHEMA extends FlexibleSchema<unknown> = FlexibleSchema<JSONValue>,
  OUTPUT extends 'object' | 'array' | 'enum' | 'no-schema' =
    InferSchema<SCHEMA> extends string ? 'enum' : 'object',
  RESULT = OUTPUT extends 'array'
    ? Array<InferSchema<SCHEMA>>
    : InferSchema<SCHEMA>,
>(
  options: Omit<LanguageModelCallOptions, 'stopSequences'> &
    Omit<RequestOptions, 'timeout'> &
    Prompt &
    (OUTPUT extends 'enum'
      ? {
          /**
           * The enum values that the model should use.
           */
          enum: Array<RESULT>;
          output: 'enum';
        }
      : OUTPUT extends 'no-schema'
        ? {}
        : {
            /**
             * The schema of the object that the model should generate.
             */
            schema: SCHEMA;

            /**
             * Optional name of the output that should be generated.
             * Used by some providers for additional LLM guidance, e.g.
             * via tool or schema name.
             */
            schemaName?: string;

            /**
             * Optional description of the output that should be generated.
             * Used by some providers for additional LLM guidance, e.g.
             * via tool or schema description.
             */
            schemaDescription?: string;
          }) & {
      output?: OUTPUT;

      /**
       * The language model to use.
       */
      model: LanguageModel;

      /**
       * A function that attempts to repair the raw output of the model
       * to enable JSON parsing.
       */
      experimental_repairText?: RepairTextFunction;

      /**
       * Optional telemetry configuration.
       */
      telemetry?: TelemetryOptions;

      /**
       * Optional telemetry configuration.
       *
       * @deprecated Use `telemetry` instead. This alias will be removed in a future major release.
       */
      experimental_telemetry?: TelemetryOptions;

      /**
       * Custom download function to use for URLs.
       *
       * By default, files are downloaded if the model does not support the URL for the given media type.
       */
      experimental_download?: DownloadFunction | undefined;

      /**
       * Additional provider-specific options. They are passed through
       * to the provider from the AI SDK and enable provider-specific
       * functionality that can be fully encapsulated in the provider.
       */
      providerOptions?: ProviderOptions;

      /**
       * Callback that is called when the streamObject operation begins,
       * before the LLM call is made.
       */
      onStart?: Callback<GenerateObjectStartEvent>;

      /**
       * Callback that is called when the streamObject operation begins,
       * before the LLM call is made.
       *
       * @deprecated Use `onStart` instead.
       */
      experimental_onStart?: Callback<GenerateObjectStartEvent>;

      /**
       * Callback that is called when the model call (step) begins,
       * before the provider is called.
       */
      onStepStart?: Callback<GenerateObjectStepStartEvent>;

      /**
       * Callback that is called when the model call (step) begins,
       * before the provider is called.
       *
       * @deprecated Use `onStepStart` instead.
       */
      experimental_onStepStart?: Callback<GenerateObjectStepStartEvent>;

      /**
       * Callback that is called when the model streaming step completes,
       * with the raw accumulated text before final schema validation.
       */
      onStepEnd?: Callback<GenerateObjectStepEndEvent>;

      /**
       * Callback that is called when the model streaming step completes,
       * with the raw accumulated text before final schema validation.
       *
       * @deprecated Use `onStepEnd` instead.
       */
      onStepFinish?: Callback<GenerateObjectStepEndEvent>;

      /**
       * Callback that is invoked when an error occurs during streaming.
       * You can use it to log errors.
       * The stream processing will pause until the callback promise is resolved.
       */
      onError?: StreamObjectOnErrorCallback;

      /**
       * Callback that is called when the LLM response and the final object validation are finished.
       */
      onFinish?: Callback<GenerateObjectEndEvent<RESULT>>;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
        now?: () => number;
      };
    },
): StreamObjectResult<
  OUTPUT extends 'enum'
    ? string
    : OUTPUT extends 'array'
      ? RESULT
      : DeepPartial<RESULT>,
  OUTPUT extends 'array' ? RESULT : RESULT,
  OUTPUT extends 'array'
    ? RESULT extends Array<infer U>
      ? AsyncIterableStream<U>
      : never
    : never
> {
  const {
    model,
    output = 'object',
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    maxRetries,
    abortSignal,
    headers,
    experimental_repairText: repairText,
    experimental_telemetry,
    telemetry = experimental_telemetry,
    experimental_download: download,
    providerOptions,
    onStart,
    experimental_onStart,
    onStepStart,
    experimental_onStepStart,
    onStepEnd,
    onStepFinish,
    onError = ({ error }: { error: unknown }) => {
      console.error(error);
    },
    onFinish,
    _internal: {
      generateId = originalGenerateId,
      currentDate = () => new Date(),
      now = originalNow,
    } = {},
    ...settings
  } = options;

  const enumValues =
    'enum' in options && options.enum ? options.enum : undefined;

  const {
    schema: inputSchema,
    schemaDescription,
    schemaName,
  } = 'schema' in options ? options : {};

  validateObjectGenerationInput({
    output,
    schema: inputSchema,
    schemaName,
    schemaDescription,
    enumValues,
  });

  const outputStrategy = getOutputStrategy({
    output,
    schema: inputSchema,
    enumValues,
  });

  return new DefaultStreamObjectResult({
    model,
    telemetry,
    headers,
    settings,
    maxRetries,
    abortSignal,
    outputStrategy,
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    schemaName,
    schemaDescription,
    providerOptions,
    repairText,
    onStart: onStart ?? experimental_onStart,
    onStepStart: onStepStart ?? experimental_onStepStart,
    onStepFinish: onStepEnd ?? onStepFinish,
    onError,
    onFinish,
    download,
    generateId,
    currentDate,
    now,
  });
}

class DefaultStreamObjectResult<
  PARTIAL,
  RESULT,
  ELEMENT_STREAM,
> implements StreamObjectResult<PARTIAL, RESULT, ELEMENT_STREAM> {
  private readonly _object = new DelayedPromise<RESULT>();
  private readonly _usage = new DelayedPromise<LanguageModelUsage>();
  private readonly _providerMetadata = new DelayedPromise<
    ProviderMetadata | undefined
  >();
  private readonly _warnings = new DelayedPromise<CallWarning[] | undefined>();
  private readonly _request = new DelayedPromise<
    Omit<LanguageModelRequestMetadata, 'messages'>
  >();
  private readonly _response = new DelayedPromise<
    Omit<LanguageModelResponseMetadata, 'messages'>
  >();
  private readonly _finishReason = new DelayedPromise<FinishReason>();

  private readonly baseStream: ReadableStream<ObjectStreamPart<PARTIAL>>;

  private readonly outputStrategy: OutputStrategy<
    PARTIAL,
    RESULT,
    ELEMENT_STREAM
  >;

  constructor({
    model: modelArg,
    headers,
    telemetry,
    settings,
    maxRetries: maxRetriesArg,
    abortSignal,
    outputStrategy,
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    schemaName,
    schemaDescription,
    providerOptions,
    repairText,
    onStart,
    onStepStart,
    onStepFinish,
    onError,
    onFinish,
    download,
    generateId,
    currentDate,
    now,
  }: {
    model: LanguageModel;
    telemetry: TelemetryOptions | undefined;
    headers: Record<string, string | undefined> | undefined;
    settings: LanguageModelCallOptions;
    maxRetries: number | undefined;
    abortSignal: AbortSignal | undefined;
    outputStrategy: OutputStrategy<PARTIAL, RESULT, ELEMENT_STREAM>;
    instructions: Prompt['instructions'];
    system: Prompt['system'];
    prompt: Prompt['prompt'];
    messages: Prompt['messages'];
    allowSystemInMessages: Prompt['allowSystemInMessages'];
    schemaName: string | undefined;
    schemaDescription: string | undefined;
    providerOptions: ProviderOptions | undefined;
    repairText: RepairTextFunction | undefined;
    onStart: Callback<GenerateObjectStartEvent> | undefined;
    onStepStart: Callback<GenerateObjectStepStartEvent> | undefined;
    onStepFinish: Callback<GenerateObjectStepEndEvent> | undefined;
    onError: StreamObjectOnErrorCallback;
    onFinish: Callback<GenerateObjectEndEvent<RESULT>> | undefined;
    download: DownloadFunction | undefined;
    generateId: () => string;
    currentDate: () => Date;
    now: () => number;
  }) {
    const model = resolveLanguageModel(modelArg);

    const { maxRetries, retry } = prepareRetries({
      maxRetries: maxRetriesArg,
      abortSignal,
    });

    const callSettings = prepareLanguageModelCallOptions(settings);

    const telemetryDispatcher = createTelemetryDispatcher({
      telemetry,
    });

    const self = this;

    const stitchableStream =
      createStitchableStream<ObjectStreamPart<PARTIAL>>();

    const eventProcessor = new TransformStream<
      ObjectStreamPart<PARTIAL>,
      ObjectStreamPart<PARTIAL>
    >({
      transform(chunk, controller) {
        controller.enqueue(chunk);

        if (chunk.type === 'error') {
          onError({ error: wrapGatewayError(chunk.error) });
        }
      },
    });

    this.baseStream = stitchableStream.stream.pipeThrough(eventProcessor);

    const callId = generateId();

    (async () => {
      const jsonSchema = await outputStrategy.jsonSchema();

      await notify({
        event: {
          callId,
          operationId: 'ai.streamObject' as const,
          provider: model.provider,
          modelId: model.modelId,
          system: instructions ?? system,
          prompt,
          messages,
          maxOutputTokens: callSettings.maxOutputTokens,
          temperature: callSettings.temperature,
          topP: callSettings.topP,
          topK: callSettings.topK,
          presencePenalty: callSettings.presencePenalty,
          frequencyPenalty: callSettings.frequencyPenalty,
          seed: callSettings.seed,
          maxRetries,
          headers,
          providerOptions,
          output: outputStrategy.type as
            | 'object'
            | 'array'
            | 'enum'
            | 'no-schema',
          schema: jsonSchema as Record<string, unknown> | undefined,
          schemaName,
          schemaDescription,
        },
        callbacks: [onStart, telemetryDispatcher.onStart],
      });

      const standardizedPrompt = await standardizePrompt({
        instructions,
        system,
        prompt,
        messages,
        allowSystemInMessages,
      } as Prompt);

      const callOptions = {
        responseFormat: {
          type: 'json' as const,
          schema: jsonSchema,
          name: schemaName,
          description: schemaDescription,
        },
        ...prepareLanguageModelCallOptions(settings),
        prompt: await convertToLanguageModelPrompt({
          prompt: standardizedPrompt,
          supportedUrls: await model.supportedUrls,
          download,
          provider: model.provider.split('.')[0],
        }),
        providerOptions,
        abortSignal,
        headers,
        includeRawChunks: false,
      };

      await notify({
        event: {
          callId,
          stepNumber: 0 as const,
          provider: model.provider,
          modelId: model.modelId,
          providerOptions,
          headers,
          promptMessages: callOptions.prompt,
        },
        callbacks: [onStepStart, telemetryDispatcher.onObjectStepStart],
      });

      const transformer: Transformer<
        LanguageModelV4StreamPart,
        ObjectStreamInputPart
      > = {
        transform: (chunk, controller) => {
          switch (chunk.type) {
            case 'text-delta':
              controller.enqueue(chunk.delta);
              break;
            case 'response-metadata':
            case 'finish':
            case 'error':
            case 'stream-start':
              controller.enqueue(chunk);
              break;
          }
        },
      };

      const startTimestampMs = now();
      const { stream, response, request } = await retry(() =>
        model.doStream(callOptions),
      );

      self._request.resolve(request ?? {});

      let warnings: SharedV4Warning[] | undefined;
      let usage: LanguageModelUsage = createNullLanguageModelUsage();
      let finishReason: FinishReason | undefined;
      let providerMetadata: ProviderMetadata | undefined;
      let object: RESULT | undefined;
      let error: unknown | undefined;
      let msToFirstChunk: number | undefined = undefined;

      let accumulatedText = '';
      let textDelta = '';
      let fullResponse: {
        id: string;
        timestamp: Date;
        modelId: string;
      } = {
        id: generateId(),
        timestamp: currentDate(),
        modelId: model.modelId,
      };

      let latestObjectJson: JSONValue | undefined = undefined;
      let latestObject: PARTIAL | undefined = undefined;
      let isFirstChunk = true;
      let isFirstDelta = true;

      const transformedStream = stream
        .pipeThrough(new TransformStream(transformer))
        .pipeThrough(
          new TransformStream<
            string | ObjectStreamInputPart,
            ObjectStreamPart<PARTIAL>
          >({
            async transform(chunk, controller): Promise<void> {
              if (typeof chunk === 'object' && chunk.type === 'stream-start') {
                warnings = chunk.warnings;
                return;
              }

              if (isFirstChunk) {
                msToFirstChunk = now() - startTimestampMs;
                isFirstChunk = false;
              }

              if (typeof chunk === 'string') {
                accumulatedText += chunk;
                textDelta += chunk;

                const { value: currentObjectJson, state: parseState } =
                  await parsePartialJson(accumulatedText);

                if (
                  currentObjectJson !== undefined &&
                  !isDeepEqualData(latestObjectJson, currentObjectJson)
                ) {
                  const validationResult =
                    await outputStrategy.validatePartialResult({
                      value: currentObjectJson,
                      textDelta,
                      latestObject,
                      isFirstDelta,
                      isFinalDelta: parseState === 'successful-parse',
                    });

                  if (
                    validationResult.success &&
                    !isDeepEqualData(
                      latestObject,
                      validationResult.value.partial,
                    )
                  ) {
                    latestObjectJson = currentObjectJson;
                    latestObject = validationResult.value.partial;

                    controller.enqueue({
                      type: 'object',
                      object: latestObject,
                    });

                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: validationResult.value.textDelta,
                    });

                    textDelta = '';
                    isFirstDelta = false;
                  }
                }

                return;
              }

              switch (chunk.type) {
                case 'response-metadata': {
                  fullResponse = {
                    id: chunk.id ?? fullResponse.id,
                    timestamp: chunk.timestamp ?? fullResponse.timestamp,
                    modelId: chunk.modelId ?? fullResponse.modelId,
                  };
                  break;
                }

                case 'finish': {
                  if (textDelta !== '') {
                    controller.enqueue({ type: 'text-delta', textDelta });
                  }

                  finishReason = chunk.finishReason.unified;

                  usage = asLanguageModelUsage(chunk.usage);
                  providerMetadata = chunk.providerMetadata;

                  controller.enqueue({
                    ...chunk,
                    finishReason: chunk.finishReason.unified,
                    usage,
                    response: fullResponse,
                  });

                  logWarnings({
                    warnings: warnings ?? [],
                    provider: model.provider,
                    model: model.modelId,
                  });

                  self._usage.resolve(usage);
                  self._providerMetadata.resolve(providerMetadata);
                  self._warnings.resolve(warnings);
                  self._response.resolve({
                    ...fullResponse,
                    headers: response?.headers,
                  });
                  self._finishReason.resolve(finishReason ?? 'other');

                  try {
                    object = await parseAndValidateObjectResultWithRepair(
                      accumulatedText,
                      outputStrategy,
                      repairText,
                      {
                        response: fullResponse,
                        usage,
                        finishReason,
                      },
                    );
                    self._object.resolve(object);
                  } catch (e) {
                    error = e;
                    self._object.reject(e);
                  }
                  break;
                }

                default: {
                  controller.enqueue(chunk);
                  break;
                }
              }
            },

            async flush(controller) {
              try {
                const finalUsage = usage ?? {
                  promptTokens: NaN,
                  completionTokens: NaN,
                  totalTokens: NaN,
                };

                await notify({
                  event: {
                    callId,
                    stepNumber: 0 as const,
                    provider: model.provider,
                    modelId: model.modelId,
                    finishReason: finishReason ?? 'other',
                    usage: finalUsage,
                    objectText: accumulatedText,
                    msToFirstChunk,
                    reasoning: undefined,
                    warnings,
                    request: request ?? {},
                    response: {
                      ...fullResponse,
                      headers: response?.headers,
                    },
                    providerMetadata,
                  },
                  callbacks: [
                    onStepFinish,
                    telemetryDispatcher.onObjectStepEnd,
                  ],
                });

                await notify({
                  event: {
                    callId,
                    object,
                    error,
                    reasoning: undefined,
                    finishReason: finishReason ?? 'other',
                    usage: finalUsage,
                    warnings,
                    request: request ?? {},
                    response: {
                      ...fullResponse,
                      headers: response?.headers,
                    },
                    providerMetadata,
                  },
                  callbacks: [onFinish, telemetryDispatcher.onEnd],
                });
              } catch (error) {
                controller.enqueue({ type: 'error', error });
              }
            },
          }),
        );

      stitchableStream.addStream(transformedStream);
    })()
      .catch(async error => {
        await telemetryDispatcher.onError?.({ callId, error });

        stitchableStream.addStream(
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'error', error });
              controller.close();
            },
          }),
        );
      })
      .finally(() => {
        stitchableStream.close();
      });

    this.outputStrategy = outputStrategy;
  }

  get object() {
    return this._object.promise;
  }

  get usage() {
    return this._usage.promise;
  }

  get providerMetadata() {
    return this._providerMetadata.promise;
  }

  get warnings() {
    return this._warnings.promise;
  }

  get request() {
    return this._request.promise;
  }

  get response() {
    return this._response.promise;
  }

  get finishReason() {
    return this._finishReason.promise;
  }

  get partialObjectStream(): AsyncIterableStream<PARTIAL> {
    return createAsyncIterableStream(
      this.baseStream.pipeThrough(
        new TransformStream<ObjectStreamPart<PARTIAL>, PARTIAL>({
          transform(chunk, controller) {
            switch (chunk.type) {
              case 'object':
                controller.enqueue(chunk.object);
                break;

              case 'text-delta':
              case 'finish':
              case 'error': // suppress error (use onError instead)
                break;

              default: {
                const _exhaustiveCheck: never = chunk;
                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
              }
            }
          },
        }),
      ),
    );
  }

  get elementStream(): ELEMENT_STREAM {
    return this.outputStrategy.createElementStream(this.baseStream);
  }

  get textStream(): AsyncIterableStream<string> {
    return createAsyncIterableStream(
      this.baseStream.pipeThrough(
        new TransformStream<ObjectStreamPart<PARTIAL>, string>({
          transform(chunk, controller) {
            switch (chunk.type) {
              case 'text-delta':
                controller.enqueue(chunk.textDelta);
                break;

              case 'object':
              case 'finish':
              case 'error': // suppress error (use onError instead)
                break;

              default: {
                const _exhaustiveCheck: never = chunk;
                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
              }
            }
          },
        }),
      ),
    );
  }

  get fullStream(): AsyncIterableStream<ObjectStreamPart<PARTIAL>> {
    return createAsyncIterableStream(this.baseStream);
  }

  pipeTextStreamToResponse(response: ServerResponse, init?: ResponseInit) {
    pipeTextStreamToResponse({
      response,
      stream: this.textStream,
      ...init,
    });
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return createTextStreamResponse({
      stream: this.textStream,
      ...init,
    });
  }
}

export type ObjectStreamInputPart =
  | string
  | {
      type: 'stream-start';
      warnings: SharedV4Warning[];
    }
  | {
      type: 'error';
      error: unknown;
    }
  | {
      type: 'response-metadata';
      id?: string;
      timestamp?: Date;
      modelId?: string;
    }
  | {
      type: 'finish';
      finishReason: LanguageModelV4FinishReason;
      usage: LanguageModelV4Usage;
      providerMetadata?: SharedV4ProviderMetadata;
    };
