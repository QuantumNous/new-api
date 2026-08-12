import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  isCustomReasoning,
  jsonSchema,
  mapReasoningToProviderEffort,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { convertToOpenResponsesInput } from './convert-to-open-responses-input';
import {
  openResponsesErrorSchema,
  type FunctionToolParam,
  type OpenResponsesRequestBody,
  type OpenResponsesResponseBody,
  type OpenResponsesChunk,
  type ToolChoiceParam,
} from './open-responses-api';
import { mapOpenResponsesFinishReason } from './map-open-responses-finish-reason';
import type { OpenResponsesConfig } from './open-responses-config';
import { openResponsesLanguageModelOptions } from './open-responses-language-model-options';

export class OpenResponsesLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: string;

  private readonly config: OpenResponsesConfig;

  static [WORKFLOW_SERIALIZE](model: OpenResponsesLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: OpenResponsesConfig;
  }) {
    return new OpenResponsesLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: string, config: OpenResponsesConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [/^https?:\/\/.*$/],
  };

  get provider(): string {
    return this.config.provider;
  }

  private async getArgs({
    maxOutputTokens,
    temperature,
    stopSequences,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    seed,
    reasoning,
    prompt,
    providerOptions,
    tools,
    toolChoice,
    responseFormat,
  }: LanguageModelV4CallOptions): Promise<{
    body: Omit<OpenResponsesRequestBody, 'stream' | 'stream_options'>;
    warnings: SharedV4Warning[];
  }> {
    const warnings: SharedV4Warning[] = [];

    if (stopSequences != null) {
      warnings.push({ type: 'unsupported', feature: 'stopSequences' });
    }

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed' });
    }

    const {
      input,
      instructions,
      warnings: inputWarnings,
    } = await convertToOpenResponsesInput({
      prompt,
    });

    warnings.push(...inputWarnings);

    // Convert function tools to the Open Responses format
    const functionTools: FunctionToolParam[] | undefined = tools
      ?.filter(tool => tool.type === 'function')
      .map(tool => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        ...(tool.strict != null ? { strict: tool.strict } : {}),
      }));

    // Convert tool choice to the Open Responses format
    const convertedToolChoice: ToolChoiceParam | undefined =
      toolChoice == null
        ? undefined
        : toolChoice.type === 'tool'
          ? { type: 'function', name: toolChoice.toolName }
          : toolChoice.type; // 'auto' | 'none' | 'required'

    const textFormat =
      responseFormat?.type === 'json'
        ? {
            type: 'json_schema' as const,
            ...(responseFormat.schema != null
              ? {
                  name: responseFormat.name ?? 'response',
                  description: responseFormat.description,
                  schema: responseFormat.schema,
                  strict: true,
                }
              : {}),
          }
        : undefined;

    const openResponsesOptions = await parseProviderOptions({
      provider: this.config.providerOptionsName,
      providerOptions,
      schema: openResponsesLanguageModelOptions,
    });

    const resolvedReasoningEffort = isCustomReasoning(reasoning)
      ? reasoning === 'none'
        ? 'none'
        : mapReasoningToProviderEffort({
            reasoning,
            effortMap: {
              minimal: 'low',
              low: 'low',
              medium: 'medium',
              high: 'high',
              xhigh: 'xhigh',
            },
            warnings,
          })
      : undefined;

    return {
      body: {
        model: this.modelId,
        input,
        instructions,
        max_output_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        reasoning:
          resolvedReasoningEffort != null ||
          openResponsesOptions?.reasoningSummary != null
            ? {
                ...(resolvedReasoningEffort != null && {
                  effort: resolvedReasoningEffort,
                }),
                ...(openResponsesOptions?.reasoningSummary != null && {
                  summary: openResponsesOptions.reasoningSummary,
                }),
              }
            : undefined,
        tools: functionTools?.length ? functionTools : undefined,
        tool_choice: convertedToolChoice,
        ...(textFormat != null && { text: { format: textFormat } }),
      },
      warnings,
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { body, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: openResponsesErrorSchema,
        errorToMessage: error => error.error.message,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        // do not validate the response body, only apply types to the response body
        jsonSchema<OpenResponsesResponseBody>(() => {
          throw new Error('json schema not implemented');
        }),
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const content: Array<LanguageModelV4Content> = [];
    let hasToolCalls = false;

    for (const part of response.output!) {
      switch (part.type) {
        // TODO AI SDK 7 adjust reasoning in the specification to better support the reasoning structure from open responses.
        case 'reasoning': {
          for (const contentPart of part.content ?? []) {
            content.push({
              type: 'reasoning',
              text: contentPart.text,
            });
          }
          break;
        }

        case 'message': {
          for (const contentPart of part.content) {
            content.push({
              type: 'text',
              text: contentPart.text,
            });
          }

          break;
        }

        case 'function_call': {
          hasToolCalls = true;
          content.push({
            type: 'tool-call',
            toolCallId: part.call_id,
            toolName: part.name,
            input: part.arguments,
          });
          break;
        }
      }
    }

    const usage = response.usage;
    const inputTokens = usage?.input_tokens;
    const cachedInputTokens = usage?.input_tokens_details?.cached_tokens;
    const outputTokens = usage?.output_tokens;
    const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens;

    return {
      content,
      finishReason: {
        unified: mapOpenResponsesFinishReason({
          finishReason: response.incomplete_details?.reason,
          hasToolCalls,
        }),
        raw: response.incomplete_details?.reason ?? undefined,
      },
      usage: {
        inputTokens: {
          total: inputTokens,
          noCache: (inputTokens ?? 0) - (cachedInputTokens ?? 0),
          cacheRead: cachedInputTokens,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: outputTokens,
          text: (outputTokens ?? 0) - (reasoningTokens ?? 0),
          reasoning: reasoningTokens,
        },
        raw: response.usage,
      },
      request: { body },
      response: {
        id: response.id,
        timestamp: new Date(response.created_at! * 1000),
        modelId: response.model,
        headers: responseHeaders,
        body: rawResponse,
      },
      providerMetadata: undefined,
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { body, warnings } = await this.getArgs(options);

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: {
        ...body,
        stream: true,
      } satisfies OpenResponsesRequestBody,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: openResponsesErrorSchema,
        errorToMessage: error => error.error.message,
      }),
      successfulResponseHandler: createEventSourceResponseHandler(z.any()),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const usage: LanguageModelV4Usage = {
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
    };

    const updateUsage = (
      responseUsage?: OpenResponsesResponseBody['usage'],
    ) => {
      if (!responseUsage) {
        return;
      }

      const inputTokens = responseUsage.input_tokens;
      const cachedInputTokens =
        responseUsage.input_tokens_details?.cached_tokens;
      const outputTokens = responseUsage.output_tokens;
      const reasoningTokens =
        responseUsage.output_tokens_details?.reasoning_tokens;

      usage.inputTokens = {
        total: inputTokens,
        noCache: (inputTokens ?? 0) - (cachedInputTokens ?? 0),
        cacheRead: cachedInputTokens,
        cacheWrite: undefined,
      };
      usage.outputTokens = {
        total: outputTokens,
        text: (outputTokens ?? 0) - (reasoningTokens ?? 0),
        reasoning: reasoningTokens,
      };
      usage.raw = responseUsage;
    };

    let isActiveReasoning = false;
    let hasToolCalls = false;
    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    const toolCallsByItemId = new Map<
      string,
      { toolName?: string; toolCallId?: string; arguments?: string }
    >();

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<OpenResponsesChunk>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(parseResult, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({
                type: 'raw',
                rawValue: parseResult.rawValue,
              });
            }

            if (!parseResult.success) {
              controller.enqueue({ type: 'error', error: parseResult.error });
              return;
            }

            const chunk = parseResult.value;

            // Tool call events (single-shot tool-call when complete)
            if (
              chunk.type === 'response.output_item.added' &&
              chunk.item.type === 'function_call'
            ) {
              toolCallsByItemId.set(chunk.item.id, {
                toolName: chunk.item.name,
                toolCallId: chunk.item.call_id,
                arguments: chunk.item.arguments,
              });
            } else if (
              chunk.type === 'response.function_call_arguments.delta'
            ) {
              const functionCallChunk = chunk;
              const toolCall = toolCallsByItemId.get(functionCallChunk.item_id);

              if (toolCall == null) {
                toolCallsByItemId.set(functionCallChunk.item_id, {
                  arguments: functionCallChunk.delta,
                });
                return;
              }

              toolCall.arguments =
                (toolCall.arguments ?? '') + functionCallChunk.delta;
            } else if (chunk.type === 'response.function_call_arguments.done') {
              const functionCallChunk = chunk;
              const toolCall = toolCallsByItemId.get(functionCallChunk.item_id);

              if (toolCall == null) {
                toolCallsByItemId.set(functionCallChunk.item_id, {
                  arguments: functionCallChunk.arguments,
                });
                return;
              }

              toolCall.arguments = functionCallChunk.arguments;
            } else if (
              chunk.type === 'response.output_item.done' &&
              chunk.item.type === 'function_call'
            ) {
              const toolCall = toolCallsByItemId.get(chunk.item.id);
              const toolName = toolCall?.toolName ?? chunk.item.name;
              const toolCallId = toolCall?.toolCallId ?? chunk.item.call_id;
              const input = toolCall?.arguments ?? chunk.item.arguments ?? '';

              controller.enqueue({
                type: 'tool-call',
                toolCallId,
                toolName,
                input,
              });
              hasToolCalls = true;

              toolCallsByItemId.delete(chunk.item.id);
            }

            // Reasoning events (note: response.reasoning_text.delta is an LM Studio extension, not in official spec)
            else if (
              chunk.type === 'response.output_item.added' &&
              chunk.item.type === 'reasoning'
            ) {
              controller.enqueue({
                type: 'reasoning-start',
                id: chunk.item.id,
              });
              isActiveReasoning = true;
            } else if (
              (chunk as { type: string }).type ===
              'response.reasoning_text.delta'
            ) {
              const reasoningChunk = chunk as {
                item_id: string;
                delta: string;
              };
              controller.enqueue({
                type: 'reasoning-delta',
                id: reasoningChunk.item_id,
                delta: reasoningChunk.delta,
              });
            } else if (
              chunk.type === 'response.output_item.done' &&
              chunk.item.type === 'reasoning'
            ) {
              controller.enqueue({ type: 'reasoning-end', id: chunk.item.id });
              isActiveReasoning = false;
            }

            // Text events
            else if (
              chunk.type === 'response.output_item.added' &&
              chunk.item.type === 'message'
            ) {
              controller.enqueue({ type: 'text-start', id: chunk.item.id });
            } else if (chunk.type === 'response.output_text.delta') {
              controller.enqueue({
                type: 'text-delta',
                id: chunk.item_id,
                delta: chunk.delta,
              });
            } else if (
              chunk.type === 'response.output_item.done' &&
              chunk.item.type === 'message'
            ) {
              controller.enqueue({ type: 'text-end', id: chunk.item.id });
            } else if (
              chunk.type === 'response.completed' ||
              chunk.type === 'response.incomplete'
            ) {
              const reason = chunk.response.incomplete_details?.reason;
              finishReason = {
                unified: mapOpenResponsesFinishReason({
                  finishReason: reason,
                  hasToolCalls,
                }),
                raw: reason ?? undefined,
              };
              updateUsage(chunk.response.usage);
            } else if (chunk.type === 'response.failed') {
              finishReason = {
                unified: 'error',
                raw: chunk.response.error?.code ?? chunk.response.status,
              };
              updateUsage(chunk.response.usage);
            }
          },

          flush(controller) {
            if (isActiveReasoning) {
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              providerMetadata: undefined,
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}
