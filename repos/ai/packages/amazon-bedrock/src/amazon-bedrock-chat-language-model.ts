import type {
  JSONObject,
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4FunctionTool,
  LanguageModelV4GenerateResult,
  LanguageModelV4Reasoning,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  isCustomReasoning,
  mapReasoningToProviderBudget,
  mapReasoningToProviderEffort,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
  type ParseResult,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { getModelCapabilities } from '@ai-sdk/anthropic/internal';
import { z } from 'zod/v4';
import {
  BEDROCK_STOP_REASONS,
  type AmazonBedrockConverseInput,
  type AmazonBedrockStopReason,
} from './amazon-bedrock-api-types';
import {
  amazonBedrockLanguageModelChatOptions,
  type AmazonBedrockLanguageModelChatOptions,
  type AmazonBedrockChatModelId,
} from './amazon-bedrock-chat-language-model-options';
import { AmazonBedrockErrorSchema } from './amazon-bedrock-error';
import { createAmazonBedrockEventStreamResponseHandler } from './amazon-bedrock-event-stream-response-handler';
import { prepareTools } from './amazon-bedrock-prepare-tools';
import {
  convertAmazonBedrockUsage,
  type AmazonBedrockUsage,
} from './convert-amazon-bedrock-usage';
import { convertToAmazonBedrockChatMessages } from './convert-to-amazon-bedrock-chat-messages';
import { mapAmazonBedrockFinishReason } from './map-amazon-bedrock-finish-reason';
import { isMistralModel, normalizeToolCallId } from './normalize-tool-call-id';
import type { AmazonBedrockReasoningMetadata } from './amazon-bedrock-reasoning-metadata';

type AmazonBedrockChatConfig = {
  baseUrl: () => string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  generateId: () => string;
};

export class AmazonBedrockChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'amazon-bedrock';

  static [WORKFLOW_SERIALIZE](model: AmazonBedrockChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: AmazonBedrockChatConfig;
  }) {
    return new AmazonBedrockChatLanguageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: AmazonBedrockChatModelId,
    private readonly config: AmazonBedrockChatConfig,
  ) {}

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
    reasoning,
    providerOptions,
  }: LanguageModelV4CallOptions): Promise<{
    command: AmazonBedrockConverseInput;
    warnings: SharedV4Warning[];
    usesJsonResponseTool: boolean;
    betas: Set<string>;
  }> {
    // Parse provider options. Prefer `amazonBedrock`; fall back to legacy
    // `bedrock` key for backward compatibility.
    let amazonBedrockOptions =
      (await parseProviderOptions({
        provider: 'amazonBedrock',
        providerOptions,
        schema: amazonBedrockLanguageModelChatOptions,
      })) ??
      (await parseProviderOptions({
        provider: 'bedrock',
        providerOptions,
        schema: amazonBedrockLanguageModelChatOptions,
      })) ??
      {};

    const warnings: SharedV4Warning[] = [];

    if (frequencyPenalty != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'frequencyPenalty',
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'presencePenalty',
      });
    }

    if (seed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'seed',
      });
    }

    if (temperature != null && temperature > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'temperature',
        details: `${temperature} exceeds bedrock maximum of 1.0. clamped to 1.0`,
      });
      temperature = 1;
    } else if (temperature != null && temperature < 0) {
      warnings.push({
        type: 'unsupported',
        feature: 'temperature',
        details: `${temperature} is below bedrock minimum of 0. clamped to 0`,
      });
      temperature = 0;
    }

    if (
      responseFormat != null &&
      responseFormat.type !== 'text' &&
      responseFormat.type !== 'json'
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details: 'Only text and json response formats are supported.',
      });
    }

    const isAnthropicModel = this.modelId.includes('anthropic');
    const isOpenAIModel = this.modelId.startsWith('openai.');

    amazonBedrockOptions = resolveAmazonBedrockReasoningConfig({
      reasoning,
      amazonBedrockOptions,
      warnings,
      isAnthropicModel,
      modelId: this.modelId,
    });

    const isThinkingEnabled =
      amazonBedrockOptions.reasoningConfig?.type === 'enabled' ||
      amazonBedrockOptions.reasoningConfig?.type === 'adaptive';

    const { supportsStructuredOutput: modelSupportsStructuredOutput } =
      getModelCapabilities(this.modelId);

    const useNativeStructuredOutput =
      isAnthropicModel &&
      (modelSupportsStructuredOutput || isThinkingEnabled) &&
      responseFormat?.type === 'json' &&
      responseFormat.schema != null;

    const jsonResponseTool: LanguageModelV4FunctionTool | undefined =
      responseFormat?.type === 'json' &&
      responseFormat.schema != null &&
      !useNativeStructuredOutput
        ? {
            type: 'function',
            name: 'json',
            description: 'Respond with a JSON object.',
            inputSchema: responseFormat.schema,
          }
        : undefined;

    const { toolConfig, additionalTools, toolWarnings, betas } =
      await prepareTools({
        tools: jsonResponseTool ? [...(tools ?? []), jsonResponseTool] : tools,
        toolChoice:
          jsonResponseTool != null ? { type: 'required' } : toolChoice,
        modelId: this.modelId,
      });

    warnings.push(...toolWarnings);

    if (additionalTools) {
      amazonBedrockOptions.additionalModelRequestFields = {
        ...amazonBedrockOptions.additionalModelRequestFields,
        ...additionalTools,
      };
    }

    if (betas.size > 0 || amazonBedrockOptions.anthropicBeta) {
      const existingBetas = amazonBedrockOptions.anthropicBeta ?? [];
      const mergedBetas =
        betas.size > 0
          ? [...existingBetas, ...Array.from(betas)]
          : existingBetas;

      amazonBedrockOptions.additionalModelRequestFields = {
        ...amazonBedrockOptions.additionalModelRequestFields,
        anthropic_beta: mergedBetas,
      };
    }

    const thinkingType = amazonBedrockOptions.reasoningConfig?.type;
    const thinkingBudget =
      thinkingType === 'enabled'
        ? amazonBedrockOptions.reasoningConfig?.budgetTokens
        : undefined;
    const thinkingDisplay =
      thinkingType === 'adaptive'
        ? amazonBedrockOptions.reasoningConfig?.display
        : undefined;
    const isAnthropicThinkingEnabled = isAnthropicModel && isThinkingEnabled;

    const inferenceConfig = {
      ...(maxOutputTokens != null && { maxTokens: maxOutputTokens }),
      ...(temperature != null && { temperature }),
      ...(topP != null && { topP }),
      ...(topK != null && { topK }),
      ...(stopSequences != null && { stopSequences }),
    };

    if (isAnthropicThinkingEnabled) {
      if (thinkingBudget != null) {
        if (inferenceConfig.maxTokens != null) {
          inferenceConfig.maxTokens += thinkingBudget;
        } else {
          inferenceConfig.maxTokens = thinkingBudget + 4096; // Default + thinking budget maxTokens = 4096, TODO update default in v5
        }
        amazonBedrockOptions.additionalModelRequestFields = {
          ...amazonBedrockOptions.additionalModelRequestFields,
          thinking: {
            type: 'enabled',
            budget_tokens: thinkingBudget,
          },
        };
      } else if (thinkingType === 'adaptive') {
        amazonBedrockOptions.additionalModelRequestFields = {
          ...amazonBedrockOptions.additionalModelRequestFields,
          thinking: {
            type: 'adaptive',
            ...(thinkingDisplay != null && { display: thinkingDisplay }),
          },
        };
      }
    } else if (!isAnthropicModel) {
      if (amazonBedrockOptions.reasoningConfig?.budgetTokens != null) {
        warnings.push({
          type: 'unsupported',
          feature: 'budgetTokens',
          details:
            'budgetTokens applies only to Anthropic models on Bedrock and will be ignored for this model.',
        });
      }
      if (thinkingType === 'adaptive') {
        warnings.push({
          type: 'unsupported',
          feature: 'adaptive thinking',
          details:
            'adaptive thinking type applies only to Anthropic models on Bedrock.',
        });
      }
    }

    const maxReasoningEffort =
      amazonBedrockOptions.reasoningConfig?.maxReasoningEffort;

    if (maxReasoningEffort != null) {
      if (isAnthropicModel) {
        amazonBedrockOptions.additionalModelRequestFields = {
          ...amazonBedrockOptions.additionalModelRequestFields,
          output_config: {
            ...amazonBedrockOptions.additionalModelRequestFields?.output_config,
            effort: maxReasoningEffort,
          },
        };
      } else if (isOpenAIModel) {
        // OpenAI models on Bedrock expect `reasoning_effort` as a flat value
        amazonBedrockOptions.additionalModelRequestFields = {
          ...amazonBedrockOptions.additionalModelRequestFields,
          reasoning_effort: maxReasoningEffort,
        };
      } else {
        // other models (such as Nova 2) use reasoningConfig format
        amazonBedrockOptions.additionalModelRequestFields = {
          ...amazonBedrockOptions.additionalModelRequestFields,
          reasoningConfig: {
            ...(thinkingType != null &&
              thinkingType !== 'adaptive' && { type: thinkingType }),
            ...(thinkingBudget != null && { budgetTokens: thinkingBudget }),
            maxReasoningEffort,
          },
        };
      }
    }

    if (useNativeStructuredOutput) {
      amazonBedrockOptions.additionalModelRequestFields = {
        ...amazonBedrockOptions.additionalModelRequestFields,
        output_config: {
          ...amazonBedrockOptions.additionalModelRequestFields?.output_config,
          format: {
            type: 'json_schema',
            schema: responseFormat!.schema,
          },
        },
      };
    }

    if (isAnthropicThinkingEnabled && inferenceConfig.temperature != null) {
      delete inferenceConfig.temperature;
      warnings.push({
        type: 'unsupported',
        feature: 'temperature',
        details: 'temperature is not supported when thinking is enabled',
      });
    }

    if (isAnthropicThinkingEnabled && inferenceConfig.topP != null) {
      delete inferenceConfig.topP;
      warnings.push({
        type: 'unsupported',
        feature: 'topP',
        details: 'topP is not supported when thinking is enabled',
      });
    }

    if (isAnthropicThinkingEnabled && inferenceConfig.topK != null) {
      delete inferenceConfig.topK;
      warnings.push({
        type: 'unsupported',
        feature: 'topK',
        details: 'topK is not supported when thinking is enabled',
      });
    }

    // Filter tool content from prompt when no tools are available
    const hasAnyTools = (toolConfig.tools?.length ?? 0) > 0 || additionalTools;
    let filteredPrompt = prompt;

    if (!hasAnyTools) {
      const hasToolContent = prompt.some(
        message =>
          'content' in message &&
          Array.isArray(message.content) &&
          message.content.some(
            part => part.type === 'tool-call' || part.type === 'tool-result',
          ),
      );

      if (hasToolContent) {
        filteredPrompt = prompt
          .map(message =>
            message.role === 'system'
              ? message
              : {
                  ...message,
                  content: message.content.filter(
                    part =>
                      part.type !== 'tool-call' && part.type !== 'tool-result',
                  ),
                },
          )
          .filter(
            message => message.role === 'system' || message.content.length > 0,
          ) as typeof prompt;

        warnings.push({
          type: 'unsupported',
          feature: 'toolContent',
          details:
            'Tool calls and results removed from conversation because Bedrock does not support tool content without active tools.',
        });
      }
    }

    const isMistral = isMistralModel(this.modelId);
    const { system, messages } = await convertToAmazonBedrockChatMessages(
      filteredPrompt,
      isMistral,
    );

    // Filter out reasoningConfig from amazonBedrock provider options to prevent sending it to Bedrock API
    const {
      reasoningConfig: _,
      additionalModelRequestFields: __,
      serviceTier: ___,
      ...filteredAmazonBedrockOptions
    } = providerOptions?.amazonBedrock ?? providerOptions?.bedrock ?? {};

    const additionalModelResponseFieldPaths = isAnthropicModel
      ? ['/delta/stop_sequence']
      : undefined;

    return {
      command: {
        system,
        messages,
        additionalModelRequestFields:
          amazonBedrockOptions.additionalModelRequestFields,
        ...(additionalModelResponseFieldPaths && {
          additionalModelResponseFieldPaths,
        }),
        ...(Object.keys(inferenceConfig).length > 0 && {
          inferenceConfig,
        }),
        ...(amazonBedrockOptions.serviceTier != null && {
          serviceTier: {
            type: amazonBedrockOptions.serviceTier,
          },
        }),
        ...filteredAmazonBedrockOptions,
        ...(toolConfig.tools !== undefined && toolConfig.tools.length > 0
          ? { toolConfig }
          : {}),
      },
      warnings,
      usesJsonResponseTool: jsonResponseTool != null,
      betas,
    };
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    // no supported urls for bedrock
  };

  private async getHeaders({
    headers,
  }: {
    headers: Record<string, string | undefined> | undefined;
  }) {
    return combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      headers,
    );
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const {
      command: args,
      warnings,
      usesJsonResponseTool,
    } = await this.getArgs(options);

    const url = `${this.getUrl(this.modelId)}/converse`;
    const { value: response, responseHeaders } = await postJsonToApi({
      url,
      headers: await this.getHeaders({ headers: options.headers }),
      body: args,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: AmazonBedrockErrorSchema,
        errorToMessage: error => `${error.message ?? 'Unknown error'}`,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        AmazonBedrockResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const content: Array<LanguageModelV4Content> = [];
    let isJsonResponseFromTool = false;

    // map response content to content array
    for (const part of response.output.message.content) {
      // text
      if (part.text != null) {
        content.push({ type: 'text', text: part.text });
      }

      // reasoning
      if (part.reasoningContent) {
        if ('reasoningText' in part.reasoningContent) {
          const reasoning: LanguageModelV4Reasoning = {
            type: 'reasoning',
            text: part.reasoningContent.reasoningText.text,
          };

          if (part.reasoningContent.reasoningText.signature) {
            const reasoningPayload: AmazonBedrockReasoningMetadata = {
              signature: part.reasoningContent.reasoningText.signature,
            };
            reasoning.providerMetadata = {
              amazonBedrock: reasoningPayload,
              bedrock: reasoningPayload,
            };
          }

          content.push(reasoning);
        } else if ('redactedReasoning' in part.reasoningContent) {
          const redactedPayload: AmazonBedrockReasoningMetadata = {
            redactedData: part.reasoningContent.redactedReasoning.data ?? '',
          };
          content.push({
            type: 'reasoning',
            text: '',
            providerMetadata: {
              amazonBedrock: redactedPayload,
              bedrock: redactedPayload,
            },
          });
        }
      }

      // tool calls
      if (part.toolUse) {
        const isJsonResponseTool =
          usesJsonResponseTool && part.toolUse.name === 'json';

        if (isJsonResponseTool) {
          isJsonResponseFromTool = true;
          // when a json response tool is used, the tool call becomes the text:
          content.push({
            type: 'text',
            text: JSON.stringify(part.toolUse.input),
          });
        } else {
          const isMistral = isMistralModel(this.modelId);
          const rawToolCallId =
            part.toolUse?.toolUseId ?? this.config.generateId();
          content.push({
            type: 'tool-call' as const,
            toolCallId: normalizeToolCallId(rawToolCallId, isMistral),
            toolName: part.toolUse?.name ?? `tool-${this.config.generateId()}`,
            input: JSON.stringify(part.toolUse?.input ?? {}),
          });
        }
      }
    }

    // provider metadata:
    const stopSequence =
      response.additionalModelResponseFields?.delta?.stop_sequence ?? null;

    const providerMetadataPayload =
      response.trace ||
      response.usage ||
      response.performanceConfig ||
      response.serviceTier ||
      isJsonResponseFromTool ||
      stopSequence
        ? {
            ...(response.trace && typeof response.trace === 'object'
              ? { trace: response.trace as JSONObject }
              : {}),
            ...(response.performanceConfig && {
              performanceConfig: response.performanceConfig,
            }),
            ...(response.serviceTier && {
              serviceTier: response.serviceTier,
            }),
            ...((response.usage?.cacheWriteInputTokens != null ||
              response.usage?.cacheDetails != null) && {
              usage: {
                ...(response.usage.cacheWriteInputTokens != null && {
                  cacheWriteInputTokens: response.usage.cacheWriteInputTokens,
                }),
                ...(response.usage.cacheDetails != null && {
                  cacheDetails: response.usage.cacheDetails,
                }),
              },
            }),
            ...(isJsonResponseFromTool && { isJsonResponseFromTool: true }),
            stopSequence,
          }
        : undefined;

    const providerMetadata = providerMetadataPayload
      ? {
          amazonBedrock: providerMetadataPayload,
          bedrock: providerMetadataPayload,
        }
      : undefined;

    return {
      content,
      finishReason: {
        unified: mapAmazonBedrockFinishReason(
          response.stopReason as AmazonBedrockStopReason,
          isJsonResponseFromTool,
        ),
        raw: response.stopReason ?? undefined,
      },
      usage: convertAmazonBedrockUsage(response.usage),
      response: {
        id: responseHeaders?.['x-amzn-requestid'] ?? undefined,
        timestamp:
          responseHeaders?.['date'] != null
            ? new Date(responseHeaders['date'])
            : undefined,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      warnings,
      ...(providerMetadata && { providerMetadata }),
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const {
      command: args,
      warnings,
      usesJsonResponseTool,
    } = await this.getArgs(options);
    const modelId = this.modelId;
    const isMistral = isMistralModel(modelId);
    const url = `${this.getUrl(modelId)}/converse-stream`;

    const { value: response, responseHeaders } = await postJsonToApi({
      url,
      headers: await this.getHeaders({ headers: options.headers }),
      body: args,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: AmazonBedrockErrorSchema,
        errorToMessage: error => `${error.type}: ${error.message}`,
      }),
      successfulResponseHandler: createAmazonBedrockEventStreamResponseHandler(
        AmazonBedrockStreamSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: AmazonBedrockUsage | undefined = undefined;
    let providerMetadata: SharedV4ProviderMetadata | undefined = undefined;
    let isJsonResponseFromTool = false;
    let stopSequence: string | null = null;

    const contentBlocks: Record<
      number,
      | {
          type: 'tool-call';
          toolCallId: string;
          toolName: string;
          jsonText: string;
          isJsonResponseTool?: boolean;
        }
      | { type: 'text' | 'reasoning' }
    > = {};

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof AmazonBedrockStreamSchema>>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
            controller.enqueue({
              type: 'response-metadata',
              id: responseHeaders?.['x-amzn-requestid'] ?? undefined,
              timestamp:
                responseHeaders?.['date'] != null
                  ? new Date(responseHeaders['date'])
                  : undefined,
              modelId,
            });
          },

          transform(chunk, controller) {
            function enqueueError(amazonBedrockError: Record<string, any>) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: amazonBedrockError });
            }

            // Emit raw chunk if requested (before anything else)
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              enqueueError(chunk.error);
              return;
            }

            const value = chunk.value;

            // handle errors:
            if (value.internalServerException) {
              enqueueError(value.internalServerException);
              return;
            }
            if (value.modelStreamErrorException) {
              enqueueError(value.modelStreamErrorException);
              return;
            }
            if (value.throttlingException) {
              enqueueError(value.throttlingException);
              return;
            }
            if (value.validationException) {
              enqueueError(value.validationException);
              return;
            }

            if (value.messageStop) {
              finishReason = {
                unified: mapAmazonBedrockFinishReason(
                  value.messageStop.stopReason as AmazonBedrockStopReason,
                  isJsonResponseFromTool,
                ),
                raw: value.messageStop.stopReason ?? undefined,
              };
              stopSequence =
                value.messageStop.additionalModelResponseFields?.delta
                  ?.stop_sequence ?? null;
            }

            if (value.metadata) {
              if (value.metadata.usage) {
                usage = value.metadata.usage;
              }

              const cacheUsage =
                value.metadata.usage?.cacheWriteInputTokens != null ||
                value.metadata.usage?.cacheDetails != null
                  ? {
                      usage: {
                        ...(value.metadata.usage?.cacheWriteInputTokens !=
                          null && {
                          cacheWriteInputTokens:
                            value.metadata.usage.cacheWriteInputTokens,
                        }),
                        ...(value.metadata.usage?.cacheDetails != null && {
                          cacheDetails: value.metadata.usage.cacheDetails,
                        }),
                      },
                    }
                  : undefined;

              const trace = value.metadata.trace
                ? {
                    trace: value.metadata.trace as JSONObject,
                  }
                : undefined;

              if (
                cacheUsage ||
                trace ||
                value.metadata.performanceConfig ||
                value.metadata.serviceTier
              ) {
                const metadataPayload = {
                  ...cacheUsage,
                  ...trace,
                  ...(value.metadata.performanceConfig && {
                    performanceConfig: value.metadata.performanceConfig,
                  }),
                  ...(value.metadata.serviceTier && {
                    serviceTier: value.metadata.serviceTier,
                  }),
                };
                providerMetadata = {
                  amazonBedrock: metadataPayload,
                  bedrock: metadataPayload,
                };
              }
            }

            if (
              value.contentBlockStart?.contentBlockIndex != null &&
              !value.contentBlockStart?.start?.toolUse
            ) {
              const blockIndex = value.contentBlockStart.contentBlockIndex;
              contentBlocks[blockIndex] = { type: 'text' };
              controller.enqueue({
                type: 'text-start',
                id: String(blockIndex),
              });
            }

            if (
              value.contentBlockDelta?.delta &&
              'text' in value.contentBlockDelta.delta &&
              value.contentBlockDelta.delta.text
            ) {
              const blockIndex = value.contentBlockDelta.contentBlockIndex || 0;

              if (contentBlocks[blockIndex] == null) {
                contentBlocks[blockIndex] = { type: 'text' };

                controller.enqueue({
                  type: 'text-start',
                  id: String(blockIndex),
                });
              }

              controller.enqueue({
                type: 'text-delta',
                id: String(blockIndex),
                delta: value.contentBlockDelta.delta.text,
              });
            }

            if (value.contentBlockStop?.contentBlockIndex != null) {
              const blockIndex = value.contentBlockStop.contentBlockIndex;
              const contentBlock = contentBlocks[blockIndex];

              if (contentBlock != null) {
                if (contentBlock.type === 'reasoning') {
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: String(blockIndex),
                  });
                } else if (contentBlock.type === 'text') {
                  controller.enqueue({
                    type: 'text-end',
                    id: String(blockIndex),
                  });
                } else if (contentBlock.type === 'tool-call') {
                  if (contentBlock.isJsonResponseTool) {
                    isJsonResponseFromTool = true;
                    // when this specific tool is the json response tool, emit the tool input as text
                    controller.enqueue({
                      type: 'text-start',
                      id: String(blockIndex),
                    });
                    controller.enqueue({
                      type: 'text-delta',
                      id: String(blockIndex),
                      delta: contentBlock.jsonText,
                    });
                    controller.enqueue({
                      type: 'text-end',
                      id: String(blockIndex),
                    });
                  } else {
                    controller.enqueue({
                      type: 'tool-input-end',
                      id: contentBlock.toolCallId,
                    });
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: contentBlock.toolCallId,
                      toolName: contentBlock.toolName,
                      input:
                        contentBlock.jsonText === ''
                          ? '{}'
                          : contentBlock.jsonText,
                    });
                  }
                }

                delete contentBlocks[blockIndex];
              }
            }

            if (
              value.contentBlockDelta?.delta &&
              'reasoningContent' in value.contentBlockDelta.delta &&
              value.contentBlockDelta.delta.reasoningContent
            ) {
              const blockIndex = value.contentBlockDelta.contentBlockIndex || 0;
              const reasoningContent =
                value.contentBlockDelta.delta.reasoningContent;

              if ('text' in reasoningContent && reasoningContent.text) {
                if (contentBlocks[blockIndex] == null) {
                  contentBlocks[blockIndex] = { type: 'reasoning' };
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: String(blockIndex),
                  });
                }

                controller.enqueue({
                  type: 'reasoning-delta',
                  id: String(blockIndex),
                  delta: reasoningContent.text,
                });
              } else if (
                'signature' in reasoningContent &&
                reasoningContent.signature
              ) {
                if (contentBlocks[blockIndex] == null) {
                  contentBlocks[blockIndex] = { type: 'reasoning' };
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: String(blockIndex),
                  });
                }
                {
                  const signaturePayload: AmazonBedrockReasoningMetadata = {
                    signature: reasoningContent.signature,
                  };
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: String(blockIndex),
                    delta: '',
                    providerMetadata: {
                      amazonBedrock: signaturePayload,
                      bedrock: signaturePayload,
                    },
                  });
                }
              } else if ('data' in reasoningContent && reasoningContent.data) {
                if (contentBlocks[blockIndex] == null) {
                  contentBlocks[blockIndex] = { type: 'reasoning' };
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: String(blockIndex),
                  });
                }
                {
                  const redactedPayload: AmazonBedrockReasoningMetadata = {
                    redactedData: reasoningContent.data,
                  };
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: String(blockIndex),
                    delta: '',
                    providerMetadata: {
                      amazonBedrock: redactedPayload,
                      bedrock: redactedPayload,
                    },
                  });
                }
              }
            }

            const contentBlockStart = value.contentBlockStart;
            if (contentBlockStart?.start?.toolUse != null) {
              const toolUse = contentBlockStart.start.toolUse;
              const blockIndex = contentBlockStart.contentBlockIndex!;
              const isJsonResponseTool =
                usesJsonResponseTool && toolUse.name === 'json';

              const normalizedToolCallId = normalizeToolCallId(
                toolUse.toolUseId!,
                isMistral,
              );
              contentBlocks[blockIndex] = {
                type: 'tool-call',
                toolCallId: normalizedToolCallId,
                toolName: toolUse.name!,
                jsonText: '',
                isJsonResponseTool,
              };

              // when this specific tool is the json response tool, we don't emit tool events
              if (!isJsonResponseTool) {
                controller.enqueue({
                  type: 'tool-input-start',
                  id: normalizedToolCallId,
                  toolName: toolUse.name!,
                });
              }
            }

            const contentBlockDelta = value.contentBlockDelta;
            if (
              contentBlockDelta?.delta &&
              'toolUse' in contentBlockDelta.delta &&
              contentBlockDelta.delta.toolUse
            ) {
              const blockIndex = contentBlockDelta.contentBlockIndex!;
              const contentBlock = contentBlocks[blockIndex];

              if (contentBlock?.type === 'tool-call') {
                const delta = contentBlockDelta.delta.toolUse.input ?? '';

                // when this specific tool is the json response tool, we don't emit tool events
                if (!contentBlock.isJsonResponseTool) {
                  controller.enqueue({
                    type: 'tool-input-delta',
                    id: contentBlock.toolCallId,
                    delta: delta,
                  });
                }

                contentBlock.jsonText += delta;
              }
            }
          },
          flush(controller) {
            // Update provider metadata with isJsonResponseFromTool and stopSequence if needed
            if (isJsonResponseFromTool || stopSequence != null) {
              const updatePayload = {
                ...(providerMetadata?.amazonBedrock ??
                  providerMetadata?.bedrock),
                ...(isJsonResponseFromTool && {
                  isJsonResponseFromTool: true,
                }),
                stopSequence,
              };
              providerMetadata = {
                ...providerMetadata,
                amazonBedrock: updatePayload,
                bedrock: updatePayload,
              };
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertAmazonBedrockUsage(usage),
              ...(providerMetadata && { providerMetadata }),
            });
          },
        }),
      ),
      // TODO request?
      response: { headers: responseHeaders },
    };
  }

  private getUrl(modelId: string) {
    const encodedModelId = encodeURIComponent(modelId);
    return `${this.config.baseUrl()}/model/${encodedModelId}`;
  }
}

const AmazonBedrockStopReasonSchema = z.union([
  z.enum(BEDROCK_STOP_REASONS),
  z.string(),
]);

const AmazonBedrockAdditionalModelResponseFieldsSchema = z
  .object({
    delta: z
      .object({
        stop_sequence: z.string().nullish(),
      })
      .nullish(),
  })
  .catchall(z.unknown());

const AmazonBedrockToolUseSchema = z.object({
  toolUseId: z.string(),
  name: z.string(),
  input: z.unknown().optional(),
});

const AmazonBedrockReasoningTextSchema = z.object({
  signature: z.string().nullish(),
  text: z.string(),
});

const AmazonBedrockRedactedReasoningSchema = z.object({
  data: z.string(),
});

// limited version of the schema, focused on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const AmazonBedrockResponseSchema = z.object({
  metrics: z
    .object({
      latencyMs: z.number(),
    })
    .nullish(),
  output: z.object({
    message: z.object({
      content: z.array(
        z.object({
          text: z.string().nullish(),
          toolUse: AmazonBedrockToolUseSchema.nullish(),
          reasoningContent: z
            .union([
              z.object({
                reasoningText: AmazonBedrockReasoningTextSchema,
              }),
              z.object({
                redactedReasoning: AmazonBedrockRedactedReasoningSchema,
              }),
            ])
            .nullish(),
        }),
      ),
      role: z.string(),
    }),
  }),
  stopReason: AmazonBedrockStopReasonSchema,
  additionalModelResponseFields:
    AmazonBedrockAdditionalModelResponseFieldsSchema.nullish(),
  trace: z.unknown().nullish(),
  performanceConfig: z.object({ latency: z.string() }).nullish(),
  serviceTier: z.object({ type: z.string() }).nullish(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    cacheReadInputTokens: z.number().nullish(),
    cacheWriteInputTokens: z.number().nullish(),
    cacheDetails: z
      .array(z.object({ inputTokens: z.number(), ttl: z.string() }))
      .nullish(),
  }),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const AmazonBedrockStreamSchema = z.object({
  contentBlockDelta: z
    .object({
      contentBlockIndex: z.number(),
      delta: z
        .union([
          z.object({ text: z.string() }),
          z.object({ toolUse: z.object({ input: z.string() }) }),
          z.object({
            reasoningContent: z.object({ text: z.string() }),
          }),
          z.object({
            reasoningContent: z.object({
              signature: z.string(),
            }),
          }),
          z.object({
            reasoningContent: z.object({ data: z.string() }),
          }),
        ])
        .nullish(),
    })
    .nullish(),
  contentBlockStart: z
    .object({
      contentBlockIndex: z.number(),
      start: z
        .object({
          toolUse: AmazonBedrockToolUseSchema.nullish(),
        })
        .nullish(),
    })
    .nullish(),
  contentBlockStop: z
    .object({
      contentBlockIndex: z.number(),
    })
    .nullish(),
  internalServerException: z.record(z.string(), z.unknown()).nullish(),
  messageStop: z
    .object({
      additionalModelResponseFields:
        AmazonBedrockAdditionalModelResponseFieldsSchema.nullish(),
      stopReason: AmazonBedrockStopReasonSchema,
    })
    .nullish(),
  metadata: z
    .object({
      trace: z.unknown().nullish(),
      performanceConfig: z.object({ latency: z.string() }).nullish(),
      serviceTier: z.object({ type: z.string() }).nullish(),
      usage: z
        .object({
          cacheReadInputTokens: z.number().nullish(),
          cacheWriteInputTokens: z.number().nullish(),
          cacheDetails: z
            .array(z.object({ inputTokens: z.number(), ttl: z.string() }))
            .nullish(),
          inputTokens: z.number(),
          outputTokens: z.number(),
        })
        .nullish(),
    })
    .nullish(),
  modelStreamErrorException: z.record(z.string(), z.unknown()).nullish(),
  throttlingException: z.record(z.string(), z.unknown()).nullish(),
  validationException: z.record(z.string(), z.unknown()).nullish(),
});

export {
  amazonBedrockReasoningMetadataSchema,
  type AmazonBedrockReasoningMetadata,
} from './amazon-bedrock-reasoning-metadata';

const amazonBedrockReasoningEffortMap: Partial<
  Record<string, 'low' | 'medium' | 'high' | 'max'>
> = {
  minimal: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'max',
};

function resolveAmazonBedrockReasoningConfig({
  reasoning,
  amazonBedrockOptions,
  warnings,
  isAnthropicModel,
  modelId,
}: {
  reasoning: LanguageModelV4CallOptions['reasoning'];
  amazonBedrockOptions: AmazonBedrockLanguageModelChatOptions;
  warnings: SharedV4Warning[];
  isAnthropicModel: boolean;
  modelId: string;
}): AmazonBedrockLanguageModelChatOptions {
  if (!isCustomReasoning(reasoning)) {
    return amazonBedrockOptions;
  }

  const result = { ...amazonBedrockOptions };

  if (isAnthropicModel) {
    const capabilities = getModelCapabilities(modelId);

    if (reasoning === 'none') {
      result.reasoningConfig = { type: 'disabled' };
    } else if (capabilities.supportsAdaptiveThinking) {
      const effort = mapReasoningToProviderEffort({
        reasoning,
        effortMap: amazonBedrockReasoningEffortMap,
        warnings,
      });
      result.reasoningConfig = {
        type: 'adaptive',
        maxReasoningEffort: effort,
        ...amazonBedrockOptions.reasoningConfig,
      };
    } else {
      const budgetTokens = mapReasoningToProviderBudget({
        reasoning,
        maxOutputTokens: capabilities.maxOutputTokens,
        maxReasoningBudget: capabilities.maxOutputTokens,
        warnings,
      });
      if (budgetTokens != null) {
        result.reasoningConfig = {
          type: 'enabled',
          budgetTokens,
          ...amazonBedrockOptions.reasoningConfig,
        };
      }
    }
  } else if (reasoning !== 'none') {
    const effort = mapReasoningToProviderEffort({
      reasoning,
      effortMap: amazonBedrockReasoningEffortMap,
      warnings,
    });
    result.reasoningConfig = {
      maxReasoningEffort: effort,
      ...amazonBedrockOptions.reasoningConfig,
    };
  }

  /*
   * Mirror anthropic-messages-language-model.ts: when the merged type ends up
   * 'disabled' (user override combined with a non-none reasoning), strip
   * derived effort/budget so downstream does not emit output_config.effort
   * alongside disabled thinking.
   */
  if (result.reasoningConfig?.type === 'disabled') {
    delete result.reasoningConfig.maxReasoningEffort;
    delete result.reasoningConfig.budgetTokens;
  }

  return result;
}
