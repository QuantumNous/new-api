import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4Source,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  JSONObject,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isCustomReasoning,
  lazySchema,
  mapReasoningToProviderBudget,
  mapReasoningToProviderEffort,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  zodSchema,
  type FetchFunction,
  type InferSchema,
  type ParseResult,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  convertGoogleUsage,
  type GoogleUsageMetadata,
} from './convert-google-usage';
import { convertJSONSchemaToOpenAPISchema } from './convert-json-schema-to-openapi-schema';
import { convertToGoogleMessages } from './convert-to-google-messages';
import { getModelPath } from './get-model-path';
import { googleFailedResponseHandler } from './google-error';
import {
  googleLanguageModelOptions,
  type GoogleLanguageModelOptions,
  type GoogleModelId,
} from './google-language-model-options';
import type { GoogleProviderMetadata } from './google-prompt';
import { prepareTools } from './google-prepare-tools';
import {
  GoogleJSONAccumulator,
  type PartialArg,
} from './google-json-accumulator';
import { mapGoogleFinishReason } from './map-google-finish-reason';

const configurableSafetySettingCategories = [
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
] as const;

type GoogleConfig = {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  generateId: () => string;

  /**
   * The supported URLs for the model.
   */
  supportedUrls?: () => LanguageModelV4['supportedUrls'];
};

export class GoogleLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  readonly modelId: GoogleModelId;

  private readonly config: GoogleConfig;
  private readonly generateId: () => string;

  static [WORKFLOW_SERIALIZE](model: GoogleLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GoogleConfig;
  }) {
    return new GoogleLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: GoogleModelId, config: GoogleConfig) {
    this.modelId = modelId;
    this.config = config;
    this.generateId = config.generateId ?? generateId;
  }

  get provider(): string {
    return this.config.provider;
  }

  get supportedUrls() {
    return this.config.supportedUrls?.() ?? {};
  }

  private async getArgs(
    {
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
    }: LanguageModelV4CallOptions,
    { isStreaming = false }: { isStreaming?: boolean } = {},
  ) {
    const warnings: SharedV4Warning[] = [];

    // Names to look up in providerOptions and to write into providerMetadata.
    // For the Vertex provider we read both the new `googleVertex` key and the
    // legacy `vertex` key (new takes precedence) and write under both for
    // backward compatibility. For other Google providers we use just `google`.
    const providerOptionsNames: readonly string[] =
      this.config.provider.includes('vertex')
        ? (['googleVertex', 'vertex'] as const)
        : (['google'] as const);

    let googleOptions: GoogleLanguageModelOptions | undefined;
    for (const name of providerOptionsNames) {
      googleOptions = await parseProviderOptions({
        provider: name,
        providerOptions,
        schema: googleLanguageModelOptions,
      });
      if (googleOptions != null) break;
    }

    // Cross-namespace fallback: a Vertex provider may receive options under
    // the `google` key (e.g. via the AI Gateway).
    if (googleOptions == null && !providerOptionsNames.includes('google')) {
      googleOptions = await parseProviderOptions({
        provider: 'google',
        providerOptions,
        schema: googleLanguageModelOptions,
      });
    }

    // Add warning if Vertex rag tools are used with a non-Vertex Google provider
    const isVertexProvider = this.config.provider.startsWith('google.vertex.');

    if (
      tools?.some(
        tool =>
          tool.type === 'provider' && tool.id === 'google.vertex_rag_store',
      ) &&
      !isVertexProvider
    ) {
      warnings.push({
        type: 'other',
        message:
          "The 'vertex_rag_store' tool is only supported with the Google Vertex provider " +
          'and might not be supported or could behave unexpectedly with the current Google provider ' +
          `(${this.config.provider}).`,
      });
    }

    if (googleOptions?.streamFunctionCallArguments && !isVertexProvider) {
      warnings.push({
        type: 'other',
        message:
          "'streamFunctionCallArguments' is only supported on the Vertex AI API " +
          'and will be ignored with the current Google provider ' +
          `(${this.config.provider}). See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#streaming-fc`,
      });
    }

    if (googleOptions?.serviceTier && isVertexProvider) {
      warnings.push({
        type: 'other',
        message:
          "'serviceTier' is a Gemini API option and is not supported on Vertex AI. " +
          "Use 'sharedRequestType' (and optionally 'requestType') instead. See " +
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/priority-paygo',
      });
    }
    if (
      (googleOptions?.sharedRequestType || googleOptions?.requestType) &&
      !isVertexProvider
    ) {
      warnings.push({
        type: 'other',
        message:
          "'sharedRequestType' and 'requestType' are Vertex AI options and " +
          `are ignored with the current Google provider (${this.config.provider}).`,
      });
    }

    const vertexPaygoHeaders: Record<string, string> | undefined =
      isVertexProvider &&
      (googleOptions?.sharedRequestType || googleOptions?.requestType)
        ? {
            ...(googleOptions.sharedRequestType && {
              'X-Vertex-AI-LLM-Shared-Request-Type':
                googleOptions.sharedRequestType,
            }),
            ...(googleOptions.requestType && {
              'X-Vertex-AI-LLM-Request-Type': googleOptions.requestType,
            }),
          }
        : undefined;
    const bodyServiceTier = isVertexProvider
      ? undefined
      : googleOptions?.serviceTier;

    // personGeneration, prominentPeople and imageOutputOptions are only
    // supported by the Vertex AI API, the Gemini API rejects them.
    let imageConfig = googleOptions?.imageConfig;
    if (imageConfig != null && !isVertexProvider) {
      const {
        personGeneration,
        prominentPeople,
        imageOutputOptions,
        ...geminiApiImageConfig
      } = imageConfig;
      const droppedImageConfigFields = Object.entries({
        personGeneration,
        prominentPeople,
        imageOutputOptions,
      })
        .filter(([, value]) => value != null)
        .map(([key]) => `'imageConfig.${key}'`);
      if (droppedImageConfigFields.length > 0) {
        warnings.push({
          type: 'other',
          message:
            `${droppedImageConfigFields.join(', ')} ` +
            `${droppedImageConfigFields.length === 1 ? 'is a Vertex AI option and is' : 'are Vertex AI options and are'} ` +
            `ignored with the current Google provider (${this.config.provider}).`,
        });
        imageConfig = geminiApiImageConfig;
      }
    }

    const isGemmaModel = this.modelId.toLowerCase().startsWith('gemma-');
    const isGemini3Model = /^gemini-3[.-]/.test(this.modelId);
    const supportsFunctionResponseParts = isGemini3Model;

    const { contents, systemInstruction } = convertToGoogleMessages(prompt, {
      isGemmaModel,
      isGemini3Model,
      onWarning: warning => warnings.push(warning),
      providerOptionsNames,
      supportsFunctionResponseParts,
    });

    const {
      tools: googleTools,
      toolConfig: googleToolConfig,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
      modelId: this.modelId,
      isVertexProvider,
    });

    const resolvedThinking = resolveThinkingConfig({
      reasoning,
      modelId: this.modelId,
      warnings,
    });
    const thinkingConfig =
      googleOptions?.thinkingConfig || resolvedThinking
        ? { ...resolvedThinking, ...googleOptions?.thinkingConfig }
        : undefined;

    const streamFunctionCallArguments =
      isStreaming && isVertexProvider
        ? (googleOptions?.streamFunctionCallArguments ?? false)
        : undefined;

    const safetyThreshold = googleOptions?.threshold;
    const safetySettings =
      googleOptions?.safetySettings ??
      (safetyThreshold != null
        ? configurableSafetySettingCategories.map(category => ({
            category,
            threshold: safetyThreshold,
          }))
        : undefined);

    const toolConfig =
      googleToolConfig ||
      streamFunctionCallArguments ||
      googleOptions?.retrievalConfig
        ? {
            ...googleToolConfig,
            ...(streamFunctionCallArguments && {
              functionCallingConfig: {
                ...googleToolConfig?.functionCallingConfig,
                streamFunctionCallArguments: true as const,
              },
            }),
            ...(googleOptions?.retrievalConfig && {
              retrievalConfig: googleOptions.retrievalConfig,
            }),
          }
        : undefined;

    return {
      args: {
        generationConfig: {
          // standardized settings:
          maxOutputTokens,
          temperature,
          topK,
          topP,
          frequencyPenalty,
          presencePenalty,
          stopSequences,
          seed,

          // response format:
          responseMimeType:
            responseFormat?.type === 'json' ? 'application/json' : undefined,
          responseSchema:
            responseFormat?.type === 'json' &&
            responseFormat.schema != null &&
            // Google GenAI does not support all OpenAPI Schema features,
            // so this is needed as an escape hatch:
            // TODO convert into provider option
            (googleOptions?.structuredOutputs ?? true)
              ? convertJSONSchemaToOpenAPISchema(responseFormat.schema)
              : undefined,
          ...(googleOptions?.audioTimestamp && {
            audioTimestamp: googleOptions.audioTimestamp,
          }),

          // provider options:
          responseModalities: googleOptions?.responseModalities,
          thinkingConfig,
          ...(googleOptions?.mediaResolution && {
            mediaResolution: googleOptions.mediaResolution,
          }),
          ...(imageConfig && { imageConfig }),
        },
        contents,
        systemInstruction: isGemmaModel ? undefined : systemInstruction,
        safetySettings,
        tools: googleTools,
        toolConfig,
        cachedContent: googleOptions?.cachedContent,
        labels: googleOptions?.labels,
        serviceTier: bodyServiceTier,
      },
      warnings: [...warnings, ...toolWarnings],
      providerOptionsNames,
      extraHeaders: vertexPaygoHeaders,
    };
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings, providerOptionsNames, extraHeaders } =
      await this.getArgs(options);
    const wrapProviderMetadata = (payload: Record<string, unknown>) =>
      Object.fromEntries(
        providerOptionsNames.map(name => [name, payload]),
      ) as SharedV4ProviderMetadata;

    const mergedHeaders = combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      options.headers,
      extraHeaders,
    );

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId,
      )}:generateContent`,
      headers: mergedHeaders,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(responseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const candidate = response.candidates[0];
    const content: Array<LanguageModelV4Content> = [];

    // map ordered parts to content:
    const parts = candidate.content?.parts ?? [];

    const usageMetadata = response.usageMetadata;

    // Associates a code execution result with its preceding call.
    let lastCodeExecutionToolCallId: string | undefined;
    // Associates a server-side tool response with its preceding call (tool combination).
    let lastServerToolCallId: string | undefined;

    // Build content array from all parts
    for (const part of parts) {
      if ('executableCode' in part && part.executableCode?.code) {
        const toolCallId = this.config.generateId();
        lastCodeExecutionToolCallId = toolCallId;

        content.push({
          type: 'tool-call',
          toolCallId,
          toolName: 'code_execution',
          input: JSON.stringify(part.executableCode),
          providerExecuted: true,
        });
      } else if ('codeExecutionResult' in part && part.codeExecutionResult) {
        content.push({
          type: 'tool-result',
          // Assumes a result directly follows its corresponding call part.
          toolCallId: lastCodeExecutionToolCallId!,
          toolName: 'code_execution',
          result: {
            outcome: part.codeExecutionResult.outcome,
            output: part.codeExecutionResult.output ?? '',
          },
        });
        // Clear the ID after use to avoid accidental reuse.
        lastCodeExecutionToolCallId = undefined;
      } else if ('text' in part && part.text != null) {
        const thoughtSignatureMetadata = part.thoughtSignature
          ? wrapProviderMetadata({
              thoughtSignature: part.thoughtSignature,
            })
          : undefined;

        if (part.text.length === 0) {
          if (thoughtSignatureMetadata != null && content.length > 0) {
            const lastContent = content[content.length - 1];
            lastContent.providerMetadata = thoughtSignatureMetadata;
          }
        } else {
          content.push({
            type: part.thought === true ? 'reasoning' : 'text',
            text: part.text,
            providerMetadata: thoughtSignatureMetadata,
          });
        }
      } else if ('functionCall' in part && part.functionCall.name != null) {
        content.push({
          type: 'tool-call' as const,
          toolCallId: part.functionCall.id ?? this.config.generateId(),
          toolName: part.functionCall.name,
          input: JSON.stringify(part.functionCall.args ?? {}),
          providerMetadata: part.thoughtSignature
            ? wrapProviderMetadata({
                thoughtSignature: part.thoughtSignature,
              })
            : undefined,
        });
      } else if ('inlineData' in part) {
        const hasThought = part.thought === true;
        const hasThoughtSignature = !!part.thoughtSignature;
        content.push({
          type: hasThought ? 'reasoning-file' : 'file',
          data: { type: 'data', data: part.inlineData.data },
          mediaType: part.inlineData.mimeType,
          providerMetadata: hasThoughtSignature
            ? wrapProviderMetadata({
                thoughtSignature: part.thoughtSignature,
              })
            : undefined,
        });
      } else if ('toolCall' in part && part.toolCall) {
        const toolCallId = part.toolCall.id ?? this.config.generateId();
        lastServerToolCallId = toolCallId;
        content.push({
          type: 'tool-call',
          toolCallId,
          toolName: `server:${part.toolCall.toolType}`,
          input: JSON.stringify(part.toolCall.args ?? {}),
          providerExecuted: true,
          dynamic: true,
          providerMetadata: part.thoughtSignature
            ? wrapProviderMetadata({
                thoughtSignature: part.thoughtSignature,
                serverToolCallId: toolCallId,
                serverToolType: part.toolCall.toolType,
              })
            : wrapProviderMetadata({
                serverToolCallId: toolCallId,
                serverToolType: part.toolCall.toolType,
              }),
        });
      } else if ('toolResponse' in part && part.toolResponse) {
        const responseToolCallId =
          lastServerToolCallId ??
          part.toolResponse.id ??
          this.config.generateId();
        content.push({
          type: 'tool-result',
          toolCallId: responseToolCallId,
          toolName: `server:${part.toolResponse.toolType}`,
          result: (part.toolResponse.response ?? {}) as JSONObject,
          providerMetadata: part.thoughtSignature
            ? wrapProviderMetadata({
                thoughtSignature: part.thoughtSignature,
                serverToolCallId: responseToolCallId,
                serverToolType: part.toolResponse.toolType,
              })
            : wrapProviderMetadata({
                serverToolCallId: responseToolCallId,
                serverToolType: part.toolResponse.toolType,
              }),
        });
        lastServerToolCallId = undefined;
      }
    }

    const sources =
      extractSources({
        groundingMetadata: candidate.groundingMetadata,
        generateId: this.config.generateId,
      }) ?? [];
    for (const source of sources) {
      content.push(source);
    }

    return {
      content,
      finishReason: {
        unified: mapGoogleFinishReason({
          finishReason: candidate.finishReason,
          // Only count client-executed tool calls for finish reason determination.
          hasToolCalls: content.some(
            part => part.type === 'tool-call' && !part.providerExecuted,
          ),
        }),
        raw: candidate.finishReason ?? undefined,
      },
      usage: convertGoogleUsage(usageMetadata),
      warnings,
      providerMetadata: wrapProviderMetadata({
        promptFeedback: response.promptFeedback ?? null,
        groundingMetadata: candidate.groundingMetadata ?? null,
        urlContextMetadata: candidate.urlContextMetadata ?? null,
        safetyRatings: candidate.safetyRatings ?? null,
        usageMetadata: usageMetadata ?? null,
        finishMessage: candidate.finishMessage ?? null,
        serviceTier: usageMetadata?.serviceTier ?? null,
      } satisfies GoogleProviderMetadata),
      request: { body: args },
      response: {
        // TODO timestamp, model id, id
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const { args, warnings, providerOptionsNames, extraHeaders } =
      await this.getArgs(options, { isStreaming: true });
    const wrapProviderMetadata = (payload: Record<string, unknown>) =>
      Object.fromEntries(
        providerOptionsNames.map(name => [name, payload]),
      ) as SharedV4ProviderMetadata;

    const headers = combineHeaders(
      this.config.headers ? await resolve(this.config.headers) : undefined,
      options.headers,
      extraHeaders,
    );

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId,
      )}:streamGenerateContent?alt=sse`,
      headers,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(chunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV4FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: GoogleUsageMetadata | undefined = undefined;
    let providerMetadata: SharedV4ProviderMetadata | undefined = undefined;
    let lastGroundingMetadata: GroundingMetadataSchema | null = null;
    let lastUrlContextMetadata: UrlContextMetadataSchema | null = null;

    const generateId = this.config.generateId;
    let hasToolCalls = false;

    // Track active blocks to group consecutive parts of same type
    let currentTextBlockId: string | null = null;
    let currentReasoningBlockId: string | null = null;
    let blockCounter = 0;

    // Track emitted sources to prevent duplicates
    const emittedSourceUrls = new Set<string>();
    // Associates a code execution result with its preceding call.
    let lastCodeExecutionToolCallId: string | undefined;
    // Associates a server-side tool response with its preceding call (tool combination).
    let lastServerToolCallId: string | undefined;

    const activeStreamingToolCalls: Array<{
      toolCallId: string;
      toolName: string;
      accumulator: GoogleJSONAccumulator;
      providerMetadata?: SharedV4ProviderMetadata;
    }> = [];

    const finishActiveStreamingToolCall = (
      controller: TransformStreamDefaultController<LanguageModelV4StreamPart>,
    ) => {
      const active = activeStreamingToolCalls.pop();
      if (active == null) {
        return;
      }

      const { finalJSON, closingDelta } = active.accumulator.finalize();

      if (closingDelta.length > 0) {
        controller.enqueue({
          type: 'tool-input-delta',
          id: active.toolCallId,
          delta: closingDelta,
          providerMetadata: active.providerMetadata,
        });
      }

      controller.enqueue({
        type: 'tool-input-end',
        id: active.toolCallId,
        providerMetadata: active.providerMetadata,
      });

      controller.enqueue({
        type: 'tool-call',
        toolCallId: active.toolCallId,
        toolName: active.toolName,
        input: finalJSON,
        providerMetadata: active.providerMetadata,
      });

      hasToolCalls = true;
    };

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<ChunkSchema>,
          LanguageModelV4StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            if (!chunk.success) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            const usageMetadata = value.usageMetadata;

            if (usageMetadata != null) {
              usage = usageMetadata;
            }

            const candidate = value.candidates?.[0];

            // sometimes the API returns an empty candidates array
            if (candidate == null) {
              return;
            }

            const content = candidate.content;

            if (candidate.groundingMetadata != null) {
              lastGroundingMetadata = candidate.groundingMetadata;
            }
            if (candidate.urlContextMetadata != null) {
              lastUrlContextMetadata = candidate.urlContextMetadata;
            }

            const sources = extractSources({
              groundingMetadata: candidate.groundingMetadata,
              generateId,
            });
            if (sources != null) {
              for (const source of sources) {
                if (
                  source.sourceType === 'url' &&
                  !emittedSourceUrls.has(source.url)
                ) {
                  emittedSourceUrls.add(source.url);
                  controller.enqueue(source);
                }
              }
            }

            // Process tool call's parts before determining finishReason to ensure hasToolCalls is properly set
            if (content != null) {
              // Process all parts in a single loop to preserve original order
              const parts = content.parts ?? [];
              for (const part of parts) {
                if ('executableCode' in part && part.executableCode?.code) {
                  const toolCallId = generateId();
                  lastCodeExecutionToolCallId = toolCallId;

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId,
                    toolName: 'code_execution',
                    input: JSON.stringify(part.executableCode),
                    providerExecuted: true,
                  });
                } else if (
                  'codeExecutionResult' in part &&
                  part.codeExecutionResult
                ) {
                  // Assumes a result directly follows its corresponding call part.
                  const toolCallId = lastCodeExecutionToolCallId;

                  if (toolCallId) {
                    controller.enqueue({
                      type: 'tool-result',
                      toolCallId,
                      toolName: 'code_execution',
                      result: {
                        outcome: part.codeExecutionResult.outcome,
                        output: part.codeExecutionResult.output ?? '',
                      },
                    });
                    // Clear the ID after use.
                    lastCodeExecutionToolCallId = undefined;
                  }
                } else if ('text' in part && part.text != null) {
                  const thoughtSignatureMetadata = part.thoughtSignature
                    ? wrapProviderMetadata({
                        thoughtSignature: part.thoughtSignature,
                      })
                    : undefined;

                  if (part.text.length === 0) {
                    if (
                      thoughtSignatureMetadata != null &&
                      currentTextBlockId !== null
                    ) {
                      controller.enqueue({
                        type: 'text-delta',
                        id: currentTextBlockId,
                        delta: '',
                        providerMetadata: thoughtSignatureMetadata,
                      });
                    }
                  } else if (part.thought === true) {
                    // End any active text block before starting reasoning
                    if (currentTextBlockId !== null) {
                      controller.enqueue({
                        type: 'text-end',
                        id: currentTextBlockId,
                      });
                      currentTextBlockId = null;
                    }

                    // Start new reasoning block if not already active
                    if (currentReasoningBlockId === null) {
                      currentReasoningBlockId = String(blockCounter++);
                      controller.enqueue({
                        type: 'reasoning-start',
                        id: currentReasoningBlockId,
                        providerMetadata: thoughtSignatureMetadata,
                      });
                    }

                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: currentReasoningBlockId,
                      delta: part.text,
                      providerMetadata: thoughtSignatureMetadata,
                    });
                  } else {
                    if (currentReasoningBlockId !== null) {
                      controller.enqueue({
                        type: 'reasoning-end',
                        id: currentReasoningBlockId,
                      });
                      currentReasoningBlockId = null;
                    }

                    if (currentTextBlockId === null) {
                      currentTextBlockId = String(blockCounter++);
                      controller.enqueue({
                        type: 'text-start',
                        id: currentTextBlockId,
                        providerMetadata: thoughtSignatureMetadata,
                      });
                    }

                    controller.enqueue({
                      type: 'text-delta',
                      id: currentTextBlockId,
                      delta: part.text,
                      providerMetadata: thoughtSignatureMetadata,
                    });
                  }
                } else if ('inlineData' in part) {
                  // End any active text or reasoning block before starting file output.
                  // Relevant for multimodal output models.
                  if (currentTextBlockId !== null) {
                    controller.enqueue({
                      type: 'text-end',
                      id: currentTextBlockId,
                    });
                    currentTextBlockId = null;
                  }
                  if (currentReasoningBlockId !== null) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: currentReasoningBlockId,
                    });
                    currentReasoningBlockId = null;
                  }

                  const hasThought = part.thought === true;
                  const hasThoughtSignature = !!part.thoughtSignature;
                  const fileMeta = hasThoughtSignature
                    ? wrapProviderMetadata({
                        thoughtSignature: part.thoughtSignature,
                      })
                    : undefined;
                  controller.enqueue({
                    type: hasThought ? 'reasoning-file' : 'file',
                    mediaType: part.inlineData.mimeType,
                    data: { type: 'data', data: part.inlineData.data },
                    providerMetadata: fileMeta,
                  });
                } else if ('toolCall' in part && part.toolCall) {
                  const toolCallId = part.toolCall.id ?? generateId();
                  lastServerToolCallId = toolCallId;
                  const serverMeta = wrapProviderMetadata({
                    ...(part.thoughtSignature
                      ? { thoughtSignature: part.thoughtSignature }
                      : {}),
                    serverToolCallId: toolCallId,
                    serverToolType: part.toolCall.toolType,
                  });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId,
                    toolName: `server:${part.toolCall.toolType}`,
                    input: JSON.stringify(part.toolCall.args ?? {}),
                    providerExecuted: true,
                    dynamic: true,
                    providerMetadata: serverMeta,
                  });
                } else if ('toolResponse' in part && part.toolResponse) {
                  const responseToolCallId =
                    lastServerToolCallId ??
                    part.toolResponse.id ??
                    generateId();
                  const serverMeta = wrapProviderMetadata({
                    ...(part.thoughtSignature
                      ? { thoughtSignature: part.thoughtSignature }
                      : {}),
                    serverToolCallId: responseToolCallId,
                    serverToolType: part.toolResponse.toolType,
                  });

                  controller.enqueue({
                    type: 'tool-result',
                    toolCallId: responseToolCallId,
                    toolName: `server:${part.toolResponse.toolType}`,
                    result: (part.toolResponse.response ?? {}) as JSONObject,
                    providerMetadata: serverMeta,
                  });
                  lastServerToolCallId = undefined;
                }
              }

              // Handle streaming and complete function calls
              for (const part of parts) {
                if (!('functionCall' in part)) continue;

                const providerMeta = part.thoughtSignature
                  ? wrapProviderMetadata({
                      thoughtSignature: part.thoughtSignature,
                    })
                  : undefined;

                const isStreamingChunk =
                  part.functionCall.partialArgs != null ||
                  (part.functionCall.name != null &&
                    part.functionCall.willContinue === true);
                const isTerminalChunk =
                  part.functionCall.name == null &&
                  part.functionCall.args == null &&
                  part.functionCall.partialArgs == null &&
                  part.functionCall.willContinue == null;
                const isCompleteCall =
                  part.functionCall.name != null &&
                  part.functionCall.args != null &&
                  part.functionCall.partialArgs == null;
                // Single-chunk no-args call: `{ name: 'X' }` with no `args`,
                // `partialArgs`, or `willContinue`. Carries `thoughtSignature`.
                const isNoArgsCompleteCall =
                  part.functionCall.name != null &&
                  part.functionCall.args == null &&
                  part.functionCall.partialArgs == null &&
                  part.functionCall.willContinue !== true;

                if (isStreamingChunk) {
                  if (part.functionCall.name != null) {
                    const toolCallId = part.functionCall.id ?? generateId();
                    const accumulator = new GoogleJSONAccumulator();
                    activeStreamingToolCalls.push({
                      toolCallId,
                      toolName: part.functionCall.name,
                      accumulator,
                      providerMetadata: providerMeta,
                    });

                    controller.enqueue({
                      type: 'tool-input-start',
                      id: toolCallId,
                      toolName: part.functionCall.name,
                      providerMetadata: providerMeta,
                    });

                    if (part.functionCall.partialArgs != null) {
                      const partialArgs = part.functionCall
                        .partialArgs as PartialArg[];
                      const { textDelta } =
                        accumulator.processPartialArgs(partialArgs);
                      if (textDelta.length > 0) {
                        controller.enqueue({
                          type: 'tool-input-delta',
                          id: toolCallId,
                          delta: textDelta,
                          providerMetadata: providerMeta,
                        });
                      }
                      if (
                        part.functionCall.willContinue !== true &&
                        partialArgs.every(arg => arg.willContinue !== true)
                      ) {
                        finishActiveStreamingToolCall(controller);
                      }
                    }
                  } else if (
                    part.functionCall.partialArgs != null &&
                    activeStreamingToolCalls.length > 0
                  ) {
                    const active =
                      activeStreamingToolCalls[
                        activeStreamingToolCalls.length - 1
                      ];
                    const partialArgs = part.functionCall
                      .partialArgs as PartialArg[];
                    const { textDelta } =
                      active.accumulator.processPartialArgs(partialArgs);
                    if (textDelta.length > 0) {
                      controller.enqueue({
                        type: 'tool-input-delta',
                        id: active.toolCallId,
                        delta: textDelta,
                        providerMetadata: providerMeta,
                      });
                    }
                    if (
                      part.functionCall.willContinue !== true &&
                      partialArgs.every(arg => arg.willContinue !== true)
                    ) {
                      finishActiveStreamingToolCall(controller);
                    }
                  }
                } else if (
                  isTerminalChunk &&
                  activeStreamingToolCalls.length > 0
                ) {
                  finishActiveStreamingToolCall(controller);
                } else if (isCompleteCall) {
                  const toolCallId = part.functionCall.id ?? generateId();
                  const toolName = part.functionCall.name!;
                  const args =
                    typeof part.functionCall.args === 'string'
                      ? part.functionCall.args
                      : JSON.stringify(part.functionCall.args ?? {});

                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCallId,
                    toolName,
                    providerMetadata: providerMeta,
                  });

                  controller.enqueue({
                    type: 'tool-input-delta',
                    id: toolCallId,
                    delta: args,
                    providerMetadata: providerMeta,
                  });

                  controller.enqueue({
                    type: 'tool-input-end',
                    id: toolCallId,
                    providerMetadata: providerMeta,
                  });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId,
                    toolName,
                    input: args,
                    providerMetadata: providerMeta,
                  });

                  hasToolCalls = true;
                } else if (isNoArgsCompleteCall) {
                  const toolCallId = part.functionCall.id ?? generateId();
                  const toolName = part.functionCall.name!;

                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCallId,
                    toolName,
                    providerMetadata: providerMeta,
                  });

                  controller.enqueue({
                    type: 'tool-input-end',
                    id: toolCallId,
                    providerMetadata: providerMeta,
                  });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId,
                    toolName,
                    input: '{}',
                    providerMetadata: providerMeta,
                  });

                  hasToolCalls = true;
                }
              }
            }

            if (candidate.finishReason != null) {
              finishReason = {
                unified: mapGoogleFinishReason({
                  finishReason: candidate.finishReason,
                  hasToolCalls,
                }),
                raw: candidate.finishReason,
              };

              providerMetadata = wrapProviderMetadata({
                promptFeedback: value.promptFeedback ?? null,
                groundingMetadata: lastGroundingMetadata,
                urlContextMetadata: lastUrlContextMetadata,
                safetyRatings: candidate.safetyRatings ?? null,
                usageMetadata: usageMetadata ?? null,
                finishMessage: candidate.finishMessage ?? null,
                serviceTier: usage?.serviceTier ?? null,
              } satisfies GoogleProviderMetadata);
            }
          },

          flush(controller) {
            if (currentTextBlockId !== null) {
              controller.enqueue({
                type: 'text-end',
                id: currentTextBlockId,
              });
            }
            if (currentReasoningBlockId !== null) {
              controller.enqueue({
                type: 'reasoning-end',
                id: currentReasoningBlockId,
              });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertGoogleUsage(usage),
              providerMetadata,
            });
          },
        }),
      ),
      response: { headers: responseHeaders },
      request: { body: args },
    };
  }
}

function isGemini3Model(modelId: string): boolean {
  return /gemini-3[\.\-]/i.test(modelId) || /gemini-3$/i.test(modelId);
}

function getMaxOutputTokensForGemini25Model(): number {
  return 65536;
}

function getMaxThinkingTokensForGemini25Model(modelId: string): number {
  const id = modelId.toLowerCase();
  if (id.includes('2.5-pro') || id.includes('gemini-3-pro-image')) {
    return 32768;
  }
  return 24576;
}

type GoogleThinkingConfig = NonNullable<
  InferSchema<typeof googleLanguageModelOptions>['thinkingConfig']
>;

function resolveThinkingConfig({
  reasoning,
  modelId,
  warnings,
}: {
  reasoning: LanguageModelV4CallOptions['reasoning'];
  modelId: string;
  warnings: SharedV4Warning[];
}): Omit<GoogleThinkingConfig, 'includeThoughts'> | undefined {
  if (!isCustomReasoning(reasoning)) {
    return undefined;
  }

  if (isGemini3Model(modelId) && !modelId.includes('gemini-3-pro-image')) {
    return resolveGemini3ThinkingConfig({ reasoning, warnings });
  }

  return resolveGemini25ThinkingConfig({ reasoning, modelId, warnings });
}

function resolveGemini3ThinkingConfig({
  reasoning,
  warnings,
}: {
  reasoning: Exclude<
    LanguageModelV4CallOptions['reasoning'],
    'provider-default' | undefined
  >;
  warnings: SharedV4Warning[];
}): Pick<GoogleThinkingConfig, 'thinkingLevel'> | undefined {
  if (reasoning === 'none') {
    // It's not possible to fully disable thinking with Gemini 3.
    return { thinkingLevel: 'minimal' };
  }

  const thinkingLevel = mapReasoningToProviderEffort({
    reasoning,
    effortMap: {
      minimal: 'minimal',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'high',
    },
    warnings,
  });

  if (thinkingLevel == null) {
    return undefined;
  }

  return { thinkingLevel };
}

function resolveGemini25ThinkingConfig({
  reasoning,
  modelId,
  warnings,
}: {
  reasoning: Exclude<
    LanguageModelV4CallOptions['reasoning'],
    'provider-default' | undefined
  >;
  modelId: string;
  warnings: SharedV4Warning[];
}): Pick<GoogleThinkingConfig, 'thinkingBudget'> | undefined {
  if (reasoning === 'none') {
    return { thinkingBudget: 0 };
  }

  const thinkingBudget = mapReasoningToProviderBudget({
    reasoning,
    maxOutputTokens: getMaxOutputTokensForGemini25Model(),
    maxReasoningBudget: getMaxThinkingTokensForGemini25Model(modelId),
    minReasoningBudget: 0,
    warnings,
  });
  if (thinkingBudget == null) {
    return undefined;
  }
  return { thinkingBudget };
}

function extractSources({
  groundingMetadata,
  generateId,
}: {
  groundingMetadata: GroundingMetadataSchema | undefined | null;
  generateId: () => string;
}): undefined | LanguageModelV4Source[] {
  if (!groundingMetadata?.groundingChunks) {
    return undefined;
  }

  const sources: LanguageModelV4Source[] = [];

  for (const chunk of groundingMetadata.groundingChunks) {
    if (chunk.web != null) {
      // Handle web chunks as URL sources
      sources.push({
        type: 'source',
        sourceType: 'url',
        id: generateId(),
        url: chunk.web.uri,
        title: chunk.web.title ?? undefined,
      });
    } else if (chunk.image != null) {
      // Handle image chunks as image sources
      sources.push({
        type: 'source',
        sourceType: 'url',
        id: generateId(),
        // Google requires attribution to the source URI, not the actual image URI.
        // TODO: add another type in v7 to allow both the image and source URL to be included separately
        url: chunk.image.sourceUri,
        title: chunk.image.title ?? undefined,
      });
    } else if (chunk.retrievedContext != null) {
      // Handle retrievedContext chunks from RAG operations
      const uri = chunk.retrievedContext.uri;
      const fileSearchStore = chunk.retrievedContext.fileSearchStore;

      if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        // Old format: Google Search with HTTP/HTTPS URL
        sources.push({
          type: 'source',
          sourceType: 'url',
          id: generateId(),
          url: uri,
          title: chunk.retrievedContext.title ?? undefined,
        });
      } else if (uri) {
        // Old format: Document with file path (gs://, etc.)
        const title = chunk.retrievedContext.title ?? 'Unknown Document';
        let mediaType = 'application/octet-stream';
        let filename: string | undefined = undefined;

        if (uri.endsWith('.pdf')) {
          mediaType = 'application/pdf';
          filename = uri.split('/').pop();
        } else if (uri.endsWith('.txt')) {
          mediaType = 'text/plain';
          filename = uri.split('/').pop();
        } else if (uri.endsWith('.docx')) {
          mediaType =
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          filename = uri.split('/').pop();
        } else if (uri.endsWith('.doc')) {
          mediaType = 'application/msword';
          filename = uri.split('/').pop();
        } else if (uri.match(/\.(md|markdown)$/)) {
          mediaType = 'text/markdown';
          filename = uri.split('/').pop();
        } else {
          filename = uri.split('/').pop();
        }

        sources.push({
          type: 'source',
          sourceType: 'document',
          id: generateId(),
          mediaType,
          title,
          filename,
        });
      } else if (fileSearchStore) {
        // New format: File Search with fileSearchStore (no uri)
        const title = chunk.retrievedContext.title ?? 'Unknown Document';
        sources.push({
          type: 'source',
          sourceType: 'document',
          id: generateId(),
          mediaType: 'application/octet-stream',
          title,
          filename: fileSearchStore.split('/').pop(),
        });
      }
    } else if (chunk.maps != null) {
      if (chunk.maps.uri) {
        sources.push({
          type: 'source',
          sourceType: 'url',
          id: generateId(),
          url: chunk.maps.uri,
          title: chunk.maps.title ?? undefined,
        });
      }
    }
  }

  return sources.length > 0 ? sources : undefined;
}

export const getGroundingMetadataSchema = () =>
  z.object({
    webSearchQueries: z.array(z.string()).nullish(),
    imageSearchQueries: z.array(z.string()).nullish(),
    retrievalQueries: z.array(z.string()).nullish(),
    searchEntryPoint: z.object({ renderedContent: z.string() }).nullish(),
    groundingChunks: z
      .array(
        z.object({
          web: z
            .object({ uri: z.string(), title: z.string().nullish() })
            .nullish(),
          image: z
            .object({
              sourceUri: z.string(),
              imageUri: z.string(),
              title: z.string().nullish(),
              domain: z.string().nullish(),
            })
            .nullish(),
          retrievedContext: z
            .object({
              uri: z.string().nullish(),
              title: z.string().nullish(),
              text: z.string().nullish(),
              fileSearchStore: z.string().nullish(),
            })
            .nullish(),
          maps: z
            .object({
              uri: z.string().nullish(),
              title: z.string().nullish(),
              text: z.string().nullish(),
              placeId: z.string().nullish(),
            })
            .nullish(),
        }),
      )
      .nullish(),
    groundingSupports: z
      .array(
        z.object({
          segment: z
            .object({
              startIndex: z.number().nullish(),
              endIndex: z.number().nullish(),
              text: z.string().nullish(),
            })
            .nullish(),
          segment_text: z.string().nullish(),
          groundingChunkIndices: z.array(z.number()).nullish(),
          supportChunkIndices: z.array(z.number()).nullish(),
          confidenceScores: z.array(z.number()).nullish(),
          confidenceScore: z.array(z.number()).nullish(),
        }),
      )
      .nullish(),
    retrievalMetadata: z
      .union([
        z.object({
          webDynamicRetrievalScore: z.number(),
        }),
        z.object({}),
      ])
      .nullish(),
  });

const partialArgSchema = z.object({
  jsonPath: z.string(),
  stringValue: z.string().nullish(),
  numberValue: z.number().nullish(),
  boolValue: z.boolean().nullish(),
  nullValue: z.unknown().nullish(),
  willContinue: z.boolean().nullish(),
});

const getContentSchema = () =>
  z.object({
    parts: z
      .array(
        z.union([
          // note: order matters since text can be fully empty
          z.object({
            functionCall: z.object({
              id: z.string().nullish(),
              name: z.string().nullish(),
              args: z.unknown().nullish(),
              partialArgs: z.array(partialArgSchema).nullish(),
              willContinue: z.boolean().nullish(),
            }),
            thoughtSignature: z.string().nullish(),
          }),
          z.object({
            inlineData: z.object({
              mimeType: z.string(),
              data: z.string(),
            }),
            thought: z.boolean().nullish(),
            thoughtSignature: z.string().nullish(),
          }),
          z.object({
            toolCall: z.object({
              toolType: z.string(),
              args: z.unknown().nullish(),
              id: z.string(),
            }),
            thoughtSignature: z.string().nullish(),
          }),
          z.object({
            toolResponse: z.object({
              toolType: z.string(),
              response: z.unknown().nullish(),
              id: z.string(),
            }),
            thoughtSignature: z.string().nullish(),
          }),
          z.object({
            executableCode: z
              .object({
                language: z.string(),
                code: z.string(),
              })
              .nullish(),
            codeExecutionResult: z
              .object({
                outcome: z.string(),
                output: z.string().nullish(),
              })
              .nullish(),
            text: z.string().nullish(),
            thought: z.boolean().nullish(),
            thoughtSignature: z.string().nullish(),
          }),
        ]),
      )
      .nullish(),
  });

// https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/configure-safety-filters
const getSafetyRatingSchema = () =>
  z.object({
    category: z.string().nullish(),
    probability: z.string().nullish(),
    probabilityScore: z.number().nullish(),
    severity: z.string().nullish(),
    severityScore: z.number().nullish(),
    blocked: z.boolean().nullish(),
  });

const tokenDetailsSchema = z
  .array(
    z.object({
      modality: z.string(),
      tokenCount: z.number(),
    }),
  )
  .nullish();

const usageSchema = z.object({
  cachedContentTokenCount: z.number().nullish(),
  thoughtsTokenCount: z.number().nullish(),
  promptTokenCount: z.number().nullish(),
  candidatesTokenCount: z.number().nullish(),
  totalTokenCount: z.number().nullish(),
  // https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/GenerateContentResponse#TrafficType
  trafficType: z.string().nullish(),
  serviceTier: z.string().nullish(),
  // https://ai.google.dev/api/generate-content#Modality
  promptTokensDetails: tokenDetailsSchema,
  candidatesTokensDetails: tokenDetailsSchema,
});

// https://ai.google.dev/api/generate-content#UrlRetrievalMetadata
export const getUrlContextMetadataSchema = () =>
  z.object({
    urlMetadata: z
      .array(
        z.object({
          retrievedUrl: z.string(),
          urlRetrievalStatus: z.string(),
        }),
      )
      .nullish(),
  });

const responseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      candidates: z.array(
        z.object({
          content: getContentSchema().nullish().or(z.object({}).strict()),
          finishReason: z.string().nullish(),
          finishMessage: z.string().nullish(),
          safetyRatings: z.array(getSafetyRatingSchema()).nullish(),
          groundingMetadata: getGroundingMetadataSchema().nullish(),
          urlContextMetadata: getUrlContextMetadataSchema().nullish(),
        }),
      ),
      usageMetadata: usageSchema.nullish(),
      promptFeedback: z
        .object({
          blockReason: z.string().nullish(),
          safetyRatings: z.array(getSafetyRatingSchema()).nullish(),
        })
        .nullish(),
    }),
  ),
);

export type GroundingMetadataSchema = NonNullable<
  InferSchema<typeof responseSchema>['candidates'][number]['groundingMetadata']
>;

export type UrlContextMetadataSchema = NonNullable<
  InferSchema<typeof responseSchema>['candidates'][number]['urlContextMetadata']
>;

export type SafetyRatingSchema = NonNullable<
  InferSchema<typeof responseSchema>['candidates'][number]['safetyRatings']
>[number];

export type PromptFeedbackSchema = NonNullable<
  InferSchema<typeof responseSchema>['promptFeedback']
>;

export type UsageMetadataSchema = NonNullable<
  InferSchema<typeof responseSchema>['usageMetadata']
>;

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const chunkSchema = lazySchema(() =>
  zodSchema(
    z.object({
      candidates: z
        .array(
          z.object({
            content: getContentSchema().nullish(),
            finishReason: z.string().nullish(),
            finishMessage: z.string().nullish(),
            safetyRatings: z.array(getSafetyRatingSchema()).nullish(),
            groundingMetadata: getGroundingMetadataSchema().nullish(),
            urlContextMetadata: getUrlContextMetadataSchema().nullish(),
          }),
        )
        .nullish(),
      usageMetadata: usageSchema.nullish(),
      promptFeedback: z
        .object({
          blockReason: z.string().nullish(),
          safetyRatings: z.array(getSafetyRatingSchema()).nullish(),
        })
        .nullish(),
    }),
  ),
);

type ChunkSchema = InferSchema<typeof chunkSchema>;
