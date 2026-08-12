import type { JSONValue } from '@ai-sdk/provider';
import {
  createIdGenerator,
  withUserAgentSuffix,
  type FlexibleSchema,
  type InferSchema,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import { NoObjectGeneratedError } from '../error/no-object-generated-error';
import { extractReasoningContent } from '../generate-text/extract-reasoning-content';
import { extractTextContent } from '../generate-text/extract-text-content';
import { logWarnings } from '../logger/log-warnings';
import { resolveLanguageModel } from '../model/resolve-model';
import { convertToLanguageModelPrompt } from '../prompt/convert-to-language-model-prompt';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import { prepareLanguageModelCallOptions } from '../prompt/prepare-language-model-call-options';
import type { Prompt } from '../prompt/prompt';
import type { RequestOptions } from '../prompt/request-options';
import { standardizePrompt } from '../prompt/standardize-prompt';
import { wrapGatewayError } from '../prompt/wrap-gateway-error';
import { createTelemetryDispatcher } from '../telemetry/create-telemetry-dispatcher';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type { LanguageModel } from '../types/language-model';
import type { LanguageModelRequestMetadata } from '../types/language-model-request-metadata';
import type { LanguageModelResponseMetadata } from '../types/language-model-response-metadata';
import { asLanguageModelUsage } from '../types/usage';
import type { Callback } from '../util/callback';
import type { DownloadFunction } from '../util/download/download-function';
import { notify } from '../util/notify';
import { prepareHeaders } from '../util/prepare-headers';
import { prepareRetries } from '../util/prepare-retries';
import { VERSION } from '../version';
import type { GenerateObjectResult } from './generate-object-result';
import { getOutputStrategy } from './output-strategy';
import { parseAndValidateObjectResultWithRepair } from './parse-and-validate-object-result';
import type { RepairTextFunction } from './repair-text';
import type {
  GenerateObjectEndEvent,
  GenerateObjectStartEvent,
  GenerateObjectStepEndEvent,
  GenerateObjectStepStartEvent,
} from './structured-output-events';
import { validateObjectGenerationInput } from './validate-object-generation-input';

const originalGenerateId = createIdGenerator({ prefix: 'aiobj', size: 24 });

/**
 * Generate a structured, typed object for a given prompt and schema using a language model.
 *
 * This function does not stream the output. If you want to stream the output, use `streamObject` instead.
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
 * @param experimental_repairText - A function that attempts to repair the raw output of the model
 * to enable JSON parsing.
 *
 * @param telemetry - Optional telemetry configuration.
 *
 * @param providerOptions - Additional provider-specific options. They are passed through
 * to the provider from the AI SDK and enable provider-specific
 * functionality that can be fully encapsulated in the provider.
 *
 * @param onStart - Callback invoked when generation begins, before the LLM call.
 * @param experimental_onStart - Deprecated alias for `onStart`.
 * @param onStepStart - Callback invoked when the model call begins.
 * @param experimental_onStepStart - Deprecated alias for `onStepStart`.
 * @param onStepEnd - Callback invoked when the model call completes with the raw result.
 * @param onStepFinish - Deprecated alias for `onStepEnd`.
 * @param onFinish - Callback invoked when the entire operation completes with the parsed object.
 *
 * @returns
 * A result object that contains the generated object, the finish reason, the token usage, and additional information.
 *
 * @deprecated Use `generateText` with an `output` setting instead.
 */
export async function generateObject<
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
       * Callback that is called when the generateObject operation begins,
       * before the LLM call is made.
       */
      onStart?: Callback<GenerateObjectStartEvent>;

      /**
       * Callback that is called when the generateObject operation begins,
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
       * Callback that is called when the model call (step) completes,
       * with the raw result before JSON parsing.
       */
      onStepEnd?: Callback<GenerateObjectStepEndEvent>;

      /**
       * Callback that is called when the model call (step) completes,
       * with the raw result before JSON parsing.
       *
       * @deprecated Use `onStepEnd` instead.
       */
      onStepFinish?: Callback<GenerateObjectStepEndEvent>;

      /**
       * Callback that is called when the entire operation completes
       * with the final parsed and validated object.
       */
      onFinish?: Callback<GenerateObjectEndEvent<RESULT>>;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<RESULT>> {
  const {
    model: modelArg,
    output = 'object',
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
    maxRetries: maxRetriesArg,
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
    onFinish,
    _internal: {
      generateId = originalGenerateId,
      currentDate = () => new Date(),
    } = {},
    ...settings
  } = options;

  const model = resolveLanguageModel(modelArg);

  const enumValues = 'enum' in options ? options.enum : undefined;
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

  const { maxRetries, retry } = prepareRetries({
    maxRetries: maxRetriesArg,
    abortSignal,
  });

  const outputStrategy = getOutputStrategy({
    output,
    schema: inputSchema,
    enumValues,
  });

  const callSettings = prepareLanguageModelCallOptions(settings);

  const headersWithUserAgent = withUserAgentSuffix(
    headers ?? {},
    `ai/${VERSION}`,
  );

  const telemetryDispatcher = createTelemetryDispatcher({
    telemetry,
  });
  const resolvedOnStart = onStart ?? experimental_onStart;
  const resolvedOnStepStart = onStepStart ?? experimental_onStepStart;
  const resolvedOnStepEnd = onStepEnd ?? onStepFinish;

  const jsonSchema = await outputStrategy.jsonSchema();
  const callId = generateId();

  await notify({
    event: {
      callId,
      operationId: 'ai.generateObject' as const,
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
      headers: headersWithUserAgent,
      providerOptions,
      output: outputStrategy.type as 'object' | 'array' | 'enum' | 'no-schema',
      schema: jsonSchema as Record<string, unknown> | undefined,
      schemaName,
      schemaDescription,
    },
    callbacks: [resolvedOnStart, telemetryDispatcher.onStart],
  });

  try {
    const standardizedPrompt = await standardizePrompt({
      instructions,
      system,
      prompt,
      messages,
      allowSystemInMessages,
    } as Prompt);

    const promptMessages = await convertToLanguageModelPrompt({
      prompt: standardizedPrompt,
      supportedUrls: await model.supportedUrls,
      download,
      provider: model.provider.split('.')[0],
    });

    await notify({
      event: {
        callId,
        stepNumber: 0 as const,
        provider: model.provider,
        modelId: model.modelId,
        providerOptions,
        headers: headersWithUserAgent,
        promptMessages,
      },
      callbacks: [resolvedOnStepStart, telemetryDispatcher.onObjectStepStart],
    });

    const generateResult = await retry(() =>
      model.doGenerate({
        responseFormat: {
          type: 'json',
          schema: jsonSchema,
          name: schemaName,
          description: schemaDescription,
        },
        ...prepareLanguageModelCallOptions(settings),
        prompt: promptMessages,
        providerOptions,
        abortSignal,
        headers: headersWithUserAgent,
      }),
    );

    const responseData = {
      id: generateResult.response?.id ?? generateId(),
      timestamp: generateResult.response?.timestamp ?? currentDate(),
      modelId: generateResult.response?.modelId ?? model.modelId,
      headers: generateResult.response?.headers,
      body: generateResult.response?.body,
    };

    const text = extractTextContent(generateResult.content);
    const reasoning = extractReasoningContent(generateResult.content);

    if (text === undefined) {
      throw new NoObjectGeneratedError({
        message: 'No object generated: the model did not return a response.',
        response: responseData,
        usage: asLanguageModelUsage(generateResult.usage),
        finishReason: generateResult.finishReason.unified,
      });
    }

    const finishReason = generateResult.finishReason.unified;
    const usage = asLanguageModelUsage(generateResult.usage);
    const warnings = generateResult.warnings;
    const resultProviderMetadata = generateResult.providerMetadata;
    const request: Omit<LanguageModelRequestMetadata, 'messages'> =
      generateResult.request ?? {};
    const response: Omit<LanguageModelResponseMetadata, 'messages'> =
      responseData;

    logWarnings({
      warnings,
      provider: model.provider,
      model: model.modelId,
    });

    const stepFinishEvent: GenerateObjectStepEndEvent = {
      callId,
      stepNumber: 0 as const,
      provider: model.provider,
      modelId: model.modelId,
      finishReason,
      usage,
      objectText: text,
      msToFirstChunk: undefined,
      reasoning,
      warnings,
      request,
      response,
      providerMetadata: resultProviderMetadata,
    };

    await notify({
      event: stepFinishEvent,
      callbacks: [resolvedOnStepEnd, telemetryDispatcher.onObjectStepEnd],
    });

    const object = await parseAndValidateObjectResultWithRepair(
      text,
      outputStrategy,
      repairText,
      {
        response,
        usage,
        finishReason,
      },
    );

    await notify({
      event: {
        callId,
        object,
        error: undefined,
        reasoning,
        finishReason,
        usage,
        warnings,
        request,
        response,
        providerMetadata: resultProviderMetadata,
      },
      callbacks: [onFinish, telemetryDispatcher.onEnd],
    });

    return new DefaultGenerateObjectResult({
      object,
      reasoning,
      finishReason,
      usage,
      warnings,
      request,
      response,
      providerMetadata: resultProviderMetadata,
    });
  } catch (error) {
    await telemetryDispatcher.onError?.({ callId, error });
    throw wrapGatewayError(error);
  }
}

class DefaultGenerateObjectResult<T> implements GenerateObjectResult<T> {
  readonly object: GenerateObjectResult<T>['object'];
  readonly finishReason: GenerateObjectResult<T>['finishReason'];
  readonly usage: GenerateObjectResult<T>['usage'];
  readonly warnings: GenerateObjectResult<T>['warnings'];
  readonly providerMetadata: GenerateObjectResult<T>['providerMetadata'];
  readonly response: GenerateObjectResult<T>['response'];
  readonly request: GenerateObjectResult<T>['request'];
  readonly reasoning: GenerateObjectResult<T>['reasoning'];

  constructor(options: {
    object: GenerateObjectResult<T>['object'];
    finishReason: GenerateObjectResult<T>['finishReason'];
    usage: GenerateObjectResult<T>['usage'];
    warnings: GenerateObjectResult<T>['warnings'];
    providerMetadata: GenerateObjectResult<T>['providerMetadata'];
    response: GenerateObjectResult<T>['response'];
    request: GenerateObjectResult<T>['request'];
    reasoning: GenerateObjectResult<T>['reasoning'];
  }) {
    this.object = options.object;
    this.finishReason = options.finishReason;
    this.usage = options.usage;
    this.warnings = options.warnings;
    this.providerMetadata = options.providerMetadata;
    this.response = options.response;
    this.request = options.request;
    this.reasoning = options.reasoning;
  }

  toJsonResponse(init?: ResponseInit): Response {
    return new Response(JSON.stringify(this.object), {
      status: init?.status ?? 200,
      headers: prepareHeaders(init?.headers, {
        'content-type': 'application/json; charset=utf-8',
      }),
    });
  }
}
