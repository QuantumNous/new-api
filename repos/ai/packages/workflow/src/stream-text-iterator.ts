import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider';
import type { Context } from '@ai-sdk/provider-utils';
import {
  experimental_filterActiveTools as filterActiveTools,
  type Experimental_LanguageModelStreamPart as ModelCallStreamPart,
  type Experimental_SandboxSession as SandboxSession,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type StepResult,
  type ToolCallRepairFunction,
  type ToolChoice,
  type ToolSet,
} from 'ai';
import { createRestrictedTelemetryDispatcher } from 'ai/internal';
import {
  type DoStreamStepRawResult,
  doStreamStep,
  type ModelStopCondition,
  type ParsedToolCall,
  type ProviderExecutedToolResult,
  type StreamFinish,
} from './do-stream-step.js';
import { serializeToolSet } from './serializable-schema.js';
import type {
  GenerationSettings,
  PrepareStepCallback,
  WorkflowAgentOnErrorCallback,
  WorkflowAgentOnStepEndCallback,
  WorkflowAgentOnStepFinishCallback,
  TelemetryOptions,
  WorkflowAgentOnStepStartCallback,
} from './workflow-agent.js';

// Re-export for consumers
export type { ProviderExecutedToolResult } from './do-stream-step.js';

/**
 * The value yielded by the stream text iterator when tool calls are requested.
 * Contains both the tool calls and the current conversation messages.
 */
export interface StreamTextIteratorYieldValue {
  /** The tool calls requested by the model (parsed with typed inputs) */
  toolCalls: ParsedToolCall[];
  /** The conversation messages up to (and including) the tool call request */
  messages: LanguageModelV4Prompt;
  /** The step result from the current step */
  step?: StepResult<ToolSet, any>;
  /** The current runtime context shared across the agent loop */
  runtimeContext?: Context;
  /** The current per-tool context, keyed by tool name */
  toolsContext?: Record<string, Context | undefined>;
  /** Provider-executed tool results (keyed by tool call ID) */
  providerExecutedToolResults?: Map<string, ProviderExecutedToolResult>;
  /** The sandbox selected for the current step. */
  experimental_sandbox?: SandboxSession;
}

// This runs in the workflow context
export async function* streamTextIterator({
  prompt,
  tools = {},
  writable,
  model,
  stopConditions,
  onStepEnd,
  onStepFinish,
  onStepStart,
  onError,
  prepareStep,
  generationSettings,
  toolChoice,
  runtimeContext,
  toolsContext,
  telemetry,
  includeRawChunks = false,
  repairToolCall,
  responseFormat,
  experimental_sandbox: sandbox,
}: {
  prompt: LanguageModelV4Prompt;
  tools: ToolSet;
  writable?: WritableStream<ModelCallStreamPart<ToolSet>>;
  model: LanguageModel;
  stopConditions?: ModelStopCondition[] | ModelStopCondition;
  onStepEnd?: WorkflowAgentOnStepEndCallback<any>;
  /** @deprecated Use `onStepEnd` instead. */
  onStepFinish?: WorkflowAgentOnStepFinishCallback<any>;
  onStepStart?: WorkflowAgentOnStepStartCallback;
  onError?: WorkflowAgentOnErrorCallback;
  prepareStep?: PrepareStepCallback<any>;
  generationSettings?: GenerationSettings;
  toolChoice?: ToolChoice<ToolSet>;
  runtimeContext?: Context;
  toolsContext?: Record<string, Context | undefined>;
  telemetry?: TelemetryOptions<Context, ToolSet>;
  includeRawChunks?: boolean;
  repairToolCall?: ToolCallRepairFunction<ToolSet>;
  responseFormat?: LanguageModelV4CallOptions['responseFormat'];
  experimental_sandbox?: SandboxSession;
}): AsyncGenerator<
  StreamTextIteratorYieldValue,
  LanguageModelV4Prompt,
  LanguageModelV4ToolResultPart[]
> {
  let conversationPrompt = [...prompt]; // Create a mutable copy
  let currentModel: LanguageModel = model;
  let currentGenerationSettings = generationSettings ?? {};
  let currentToolChoice = toolChoice;
  let currentRuntimeContext: Context = runtimeContext ?? {};
  let currentToolsContext: Record<string, Context | undefined> =
    toolsContext ?? {};
  let currentActiveTools: string[] | undefined;

  const steps: StepResult<any, any>[] = [];
  let done = false;
  let _isFirstIteration = true;
  let stepNumber = 0;
  let lastStep: StepResult<any, any> | undefined;
  let lastStepWasToolCalls = false;

  // TODO(#12164): replace this AI-core telemetry bridge with a
  // WorkflowAgent-specific typed dispatcher. `streamTextIterator` widens
  // tools/runtime context and emits Workflow-shaped events that are only
  // approximately compatible with generateText telemetry event types.
  const telemetryDispatcher = createRestrictedTelemetryDispatcher<
    any,
    any,
    any
  >({
    telemetry: telemetry as any,
    includeRuntimeContext: telemetry?.includeRuntimeContext,
    includeToolsContext: telemetry?.includeToolsContext,
  }) as any;

  while (!done) {
    // Check for abort signal
    if (currentGenerationSettings.abortSignal?.aborted) {
      break;
    }

    let stepSandbox = sandbox;

    // Call prepareStep callback before each step if provided
    if (prepareStep) {
      const prepareResult = await prepareStep({
        model: currentModel,
        stepNumber,
        steps,
        messages: conversationPrompt,
        runtimeContext: currentRuntimeContext,
        toolsContext: currentToolsContext as never,
        experimental_sandbox: sandbox,
      });

      stepSandbox = prepareResult?.experimental_sandbox ?? sandbox;

      // Apply any overrides from prepareStep
      if (prepareResult?.model !== undefined) {
        currentModel = prepareResult.model;
      }
      // Apply messages override BEFORE system so the system message
      // isn't lost when messages replaces the prompt.
      if (prepareResult?.messages !== undefined) {
        conversationPrompt = [...prepareResult.messages];
      }
      if (prepareResult?.system !== undefined) {
        // Update or prepend system message in the conversation prompt.
        // Applied AFTER messages override so the system message isn't
        // lost when messages replaces the prompt.
        if (
          conversationPrompt.length > 0 &&
          conversationPrompt[0].role === 'system'
        ) {
          // Replace existing system message
          conversationPrompt[0] = {
            role: 'system',
            content: prepareResult.system,
          };
        } else {
          // Prepend new system message
          conversationPrompt.unshift({
            role: 'system',
            content: prepareResult.system,
          });
        }
      }
      if (prepareResult?.runtimeContext !== undefined) {
        currentRuntimeContext = prepareResult.runtimeContext;
      }
      if (prepareResult?.toolsContext !== undefined) {
        currentToolsContext = prepareResult.toolsContext as Record<
          string,
          Context | undefined
        >;
      }
      if (prepareResult?.activeTools !== undefined) {
        currentActiveTools = prepareResult.activeTools;
      }
      // Apply generation settings overrides
      if (prepareResult?.maxOutputTokens !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          maxOutputTokens: prepareResult.maxOutputTokens,
        };
      }
      if (prepareResult?.temperature !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          temperature: prepareResult.temperature,
        };
      }
      if (prepareResult?.topP !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          topP: prepareResult.topP,
        };
      }
      if (prepareResult?.topK !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          topK: prepareResult.topK,
        };
      }
      if (prepareResult?.presencePenalty !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          presencePenalty: prepareResult.presencePenalty,
        };
      }
      if (prepareResult?.frequencyPenalty !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          frequencyPenalty: prepareResult.frequencyPenalty,
        };
      }
      if (prepareResult?.stopSequences !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          stopSequences: prepareResult.stopSequences,
        };
      }
      if (prepareResult?.seed !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          seed: prepareResult.seed,
        };
      }
      if (prepareResult?.maxRetries !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          maxRetries: prepareResult.maxRetries,
        };
      }
      if (prepareResult?.headers !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          headers: prepareResult.headers,
        };
      }
      if (prepareResult?.reasoning !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          reasoning: prepareResult.reasoning,
        };
      }
      if (prepareResult?.providerOptions !== undefined) {
        currentGenerationSettings = {
          ...currentGenerationSettings,
          providerOptions: prepareResult.providerOptions,
        };
      }
      if (prepareResult?.toolChoice !== undefined) {
        currentToolChoice = prepareResult.toolChoice;
      }
    }

    if (onStepStart) {
      await onStepStart({
        stepNumber,
        model: currentModel,
        messages: conversationPrompt as unknown as ModelMessage[],
        steps: [...steps],
        runtimeContext: currentRuntimeContext,
        toolsContext: currentToolsContext as never,
      });
    }

    const stepStartModelInfo = getModelInfo(currentModel);
    await telemetryDispatcher.onStepStart?.({
      callId: 'workflow-agent',
      provider: stepStartModelInfo.provider,
      modelId: stepStartModelInfo.modelId,
      stepNumber,
      system: undefined,
      messages: conversationPrompt as unknown as ModelMessage[],
      tools,
      toolChoice: currentToolChoice,
      activeTools: currentActiveTools as never,
      steps: steps.map(normalizeStepForTelemetry),
      providerOptions: currentGenerationSettings.providerOptions,
      output: undefined,
      runtimeContext: currentRuntimeContext,
      toolsContext: currentToolsContext as never,
    });

    try {
      // Filter tools if activeTools is specified
      const effectiveTools =
        currentActiveTools && currentActiveTools.length > 0
          ? (filterActiveTools({
              tools,
              activeTools: currentActiveTools,
            }) ?? tools)
          : tools;

      // Serialize tools before crossing the step boundary — zod schemas
      // contain functions that can't be serialized by the workflow runtime.
      // Tools are reconstructed with Ajv validation inside doStreamStep.
      const serializedTools = serializeToolSet(effectiveTools);
      const modelCallInfo = getModelInfo(currentModel);

      await telemetryDispatcher.onLanguageModelCallStart?.({
        callId: 'workflow-agent',
        provider: modelCallInfo.provider,
        modelId: modelCallInfo.modelId,
        system: undefined,
        messages: conversationPrompt as unknown as ModelMessage[],
        tools:
          serializedTools == null
            ? undefined
            : Object.values(serializedTools).map(tool => ({ ...tool })),
        maxOutputTokens: currentGenerationSettings.maxOutputTokens,
        temperature: currentGenerationSettings.temperature,
        topP: currentGenerationSettings.topP,
        topK: currentGenerationSettings.topK,
        presencePenalty: currentGenerationSettings.presencePenalty,
        frequencyPenalty: currentGenerationSettings.frequencyPenalty,
        stopSequences: currentGenerationSettings.stopSequences,
        seed: currentGenerationSettings.seed,
        reasoning: currentGenerationSettings.reasoning,
        providerOptions: currentGenerationSettings.providerOptions,
        headers: currentGenerationSettings.headers,
      } as never);

      const { toolCalls, finish, raw, providerExecutedToolResults } =
        await doStreamStep(
          conversationPrompt,
          currentModel,
          writable,
          serializedTools,
          {
            ...currentGenerationSettings,
            toolChoice: currentToolChoice,
            includeRawChunks,
            repairToolCall,
            responseFormat,
          },
        );
      // Reconstruct the full StepResult outside the step boundary so the
      // durable event log doesn't carry StepResult's redundant copies (or the
      // per-chunk snapshot the step used to return).
      const step = buildStepResult(raw, toolCalls, finish, {
        stepNumber,
        runtimeContext: currentRuntimeContext,
        toolsContext: currentToolsContext,
      });

      await telemetryDispatcher.onLanguageModelCallEnd?.({
        callId: step.callId,
        provider: step.model?.provider ?? 'unknown',
        modelId: step.model?.modelId ?? 'unknown',
        finishReason: step.finishReason,
        usage: step.usage,
        content: step.content,
        responseId: step.response.id,
      });

      _isFirstIteration = false;
      stepNumber++;
      steps.push(step);
      lastStep = step;
      lastStepWasToolCalls = false;

      const finishReason = finish?.finishReason;

      if (finishReason === 'tool-calls') {
        lastStepWasToolCalls = true;

        // Add assistant message with tool calls to the conversation
        // Note: providerMetadata from the tool call is mapped to providerOptions
        // in the prompt format, following the AI SDK convention. This is critical
        // for providers like Gemini that require thoughtSignature to be preserved
        // across multi-turn tool calls. Some fields are sanitized before mapping.
        conversationPrompt.push({
          role: 'assistant',
          content: toolCalls.map(toolCall => {
            const sanitizedMetadata = sanitizeProviderMetadataForToolCall(
              toolCall.providerMetadata,
            );
            return {
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              input: toolCall.input,
              ...(sanitizedMetadata != null
                ? { providerOptions: sanitizedMetadata }
                : {}),
            };
          }) as typeof toolCalls,
        });

        // Yield the tool calls along with the current conversation messages
        // This allows executeTool to pass the conversation context to tool execute functions
        // Also include provider-executed tool results so they can be used instead of local execution
        const toolResults = yield {
          toolCalls,
          messages: conversationPrompt,
          step,
          runtimeContext: currentRuntimeContext,
          toolsContext: currentToolsContext,
          experimental_sandbox: stepSandbox,
          providerExecutedToolResults,
        };

        conversationPrompt.push({
          role: 'tool',
          content: toolResults,
        });

        if (stopConditions) {
          const stopConditionList = Array.isArray(stopConditions)
            ? stopConditions
            : [stopConditions];
          if (stopConditionList.some(test => test({ steps }))) {
            done = true;
          }
        }
      } else if (finishReason === 'stop') {
        // Add assistant message with text content to the conversation
        const textContent = step.content.filter(
          item => item.type === 'text',
        ) as Array<{ type: 'text'; text: string }>;

        if (textContent.length > 0) {
          conversationPrompt.push({
            role: 'assistant',
            content: textContent,
          });
        }

        done = true;
      } else if (finishReason === 'length') {
        // Model hit max tokens - stop but don't throw
        done = true;
      } else if (finishReason === 'content-filter') {
        // Content filter triggered - stop but don't throw
        done = true;
      } else if (finishReason === 'error') {
        // Model error - stop but don't throw
        done = true;
      } else if (finishReason === 'other') {
        // Other reason - stop but don't throw
        done = true;
      } else if (finishReason === 'unknown') {
        // Unknown reason - stop but don't throw
        done = true;
      } else if (!finishReason) {
        // No finish reason - this might happen on incomplete streams
        done = true;
      } else {
        throw new Error(
          `Unexpected finish reason: ${typeof finish?.finishReason === 'object' ? JSON.stringify(finish?.finishReason) : finish?.finishReason}`,
        );
      }

      const resolvedOnStepEnd = onStepEnd ?? onStepFinish;
      if (resolvedOnStepEnd) {
        await resolvedOnStepEnd(step);
      }
      await telemetryDispatcher.onStepEnd?.(normalizeStepForTelemetry(step));
    } catch (error) {
      if (onError) {
        await onError({ error });
      }
      throw error;
    }
  }

  // Yield the final step if it wasn't already yielded (tool-calls steps are yielded inside the loop)
  if (lastStep && !lastStepWasToolCalls) {
    yield {
      toolCalls: [],
      messages: conversationPrompt,
      step: lastStep,
      runtimeContext: currentRuntimeContext,
      toolsContext: currentToolsContext,
      experimental_sandbox: sandbox,
    };
  }

  return conversationPrompt;
}

function getModelInfo(model: LanguageModel): {
  provider: string;
  modelId: string;
} {
  return typeof model === 'string'
    ? { provider: model.split('/')[0] ?? 'gateway', modelId: model }
    : { provider: model.provider, modelId: model.modelId };
}

function normalizeStepForTelemetry(step: StepResult<any, any>) {
  return {
    ...step,
    model: step.model ?? { provider: 'unknown', modelId: 'unknown' },
  };
}

/**
 * Reconstruct a full `StepResult` from the minimal aggregates returned by
 * `doStreamStep`. Runs outside the step boundary so StepResult's redundant
 * fields (duplicate tool-call lists, `content`, `reasoningText`, the
 * always-empty `*ToolResults` arrays) and the per-chunk snapshot don't cross
 * it. The shape matches what the AI SDK's `streamText` exposes to callers.
 */
function buildStepResult(
  raw: DoStreamStepRawResult,
  toolCalls: ParsedToolCall[],
  finish: StreamFinish | undefined,
  opts: {
    stepNumber: number;
    runtimeContext: Context;
    toolsContext: Record<string, Context | undefined>;
  },
): StepResult<ToolSet, any> {
  const { text, reasoning: reasoningParts, responseMetadata, warnings } = raw;
  const reasoningText = reasoningParts.map(r => r.text).join('') || undefined;

  const validToolCalls = toolCalls
    .filter(tc => !tc.invalid)
    .map(tc => ({
      type: 'tool-call' as const,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      input: tc.input,
      ...(tc.dynamic ? { dynamic: true as const } : {}),
    }));

  return {
    callId: 'workflow-agent',
    stepNumber: opts.stepNumber,
    model: {
      provider: responseMetadata?.modelId?.split(':')[0] ?? 'unknown',
      modelId: responseMetadata?.modelId ?? 'unknown',
    },
    functionId: undefined,
    metadata: undefined,
    runtimeContext: opts.runtimeContext ?? {},
    toolsContext: opts.toolsContext ?? {},
    content: [
      ...(text ? [{ type: 'text' as const, text }] : []),
      ...validToolCalls,
    ],
    text,
    reasoning: reasoningParts.map(r => ({
      type: 'reasoning' as const,
      text: r.text,
    })),
    reasoningText,
    files: [],
    sources: [],
    toolCalls: validToolCalls,
    staticToolCalls: [],
    dynamicToolCalls: validToolCalls.filter(tc => tc.dynamic),
    toolResults: [],
    staticToolResults: [],
    dynamicToolResults: [],
    finishReason: finish?.finishReason ?? 'other',
    rawFinishReason: finish?.rawFinishReason,
    usage:
      finish?.usage ??
      ({
        inputTokens: 0,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: 0,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: 0,
      } as LanguageModelUsage),
    performance: {
      effectiveOutputTokensPerSecond: 0,
      outputTokensPerSecond: undefined,
      inputTokensPerSecond: undefined,
      effectiveTotalTokensPerSecond: 0,
      stepTimeMs: 0,
      responseTimeMs: 0,
      toolExecutionMs: {},
      timeToFirstOutputMs: undefined,
    },
    warnings,
    request: {
      body: '',
      messages: [], // TODO implement step request messages
    },
    response: {
      id: responseMetadata?.id ?? 'unknown',
      timestamp: responseMetadata?.timestamp ?? new Date(),
      modelId: responseMetadata?.modelId ?? 'unknown',
      messages: [],
    },
    providerMetadata: finish?.providerMetadata ?? {},
  } as StepResult<ToolSet, any>;
}

/**
 * Strip OpenAI's itemId from providerMetadata (requires reasoning items we don't preserve).
 * Preserves all other provider metadata (e.g., Gemini's thoughtSignature).
 */
function sanitizeProviderMetadataForToolCall(
  metadata: unknown,
): Record<string, unknown> | undefined {
  if (metadata == null) return undefined;

  const meta = metadata as Record<string, unknown>;

  // Check if OpenAI metadata exists and needs sanitization
  if ('openai' in meta && meta.openai != null) {
    const { openai, ...restProviders } = meta;
    const openaiMeta = openai as Record<string, unknown>;

    // Remove itemId from OpenAI metadata - it requires reasoning items we don't preserve
    const { itemId: _itemId, ...restOpenai } = openaiMeta;

    // Reconstruct metadata without itemId
    const hasOtherOpenaiFields = Object.keys(restOpenai).length > 0;
    const hasOtherProviders = Object.keys(restProviders).length > 0;

    if (hasOtherOpenaiFields && hasOtherProviders) {
      return { ...restProviders, openai: restOpenai };
    } else if (hasOtherOpenaiFields) {
      return { openai: restOpenai };
    } else if (hasOtherProviders) {
      return restProviders;
    }
    return undefined;
  }

  return meta;
}
