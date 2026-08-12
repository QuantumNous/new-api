import {
  context,
  SpanKind,
  trace,
  type Attributes,
  type Context as OpenTelemetryContext,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import type {
  EmbeddingModelCallEndEvent,
  EmbedEndEvent,
  EmbedStartEvent,
  LanguageModelCallEndEvent,
  LanguageModelCallStartEvent,
  EmbeddingModelCallStartEvent,
  GenerateObjectEndEvent,
  GenerateObjectStartEvent,
  GenerateObjectStepEndEvent,
  GenerateObjectStepStartEvent,
  GenerateTextAbortEvent,
  GenerateTextEndEvent,
  GenerateTextStartEvent,
  GenerateTextStepEndEvent,
  GenerateTextStepStartEvent,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
  RerankingModelCallEndEvent,
  RerankEndEvent,
  RerankStartEvent,
  RerankingModelCallStartEvent,
  InferTelemetryEvent,
  Telemetry,
  TelemetryOptions,
  ToolSet,
} from 'ai';
import {
  formatInputMessages,
  formatModelMessages,
  formatObjectOutputMessages,
  formatOutputMessages,
  formatSystemInstructions,
  mapOperationName,
  mapProviderName,
} from './gen-ai-format-messages';
import { recordErrorOnSpan } from './record-span';
import { sanitizeAttributes } from './sanitize-attribute-value';
import { selectAttributes } from './select-attributes';
import {
  getDetailedUsageAttributes,
  getHeaderAttributes,
  getRuntimeContextAttributes,
  normalizeSupplementalAttributes,
  selectSupplementalAttributes,
  type EnrichSpan,
  type OpenTelemetryOptions,
  type OpenTelemetrySpanType,
  type SupplementalAttributeOptions,
} from './supplemental-attributes';

export type {
  EnrichSpan,
  OpenTelemetryOptions,
  OpenTelemetrySpanType,
} from './supplemental-attributes';

interface OtelStepStartEvent extends GenerateTextStepStartEvent<ToolSet> {
  readonly stepToolChoice?: unknown;
}

interface CallState {
  operationId: string;
  telemetry: TelemetryOptions | undefined;
  rootSpan: Span | undefined;
  rootContext: OpenTelemetryContext | undefined;
  stepSpan: Span | undefined;
  stepContext: OpenTelemetryContext | undefined;
  inferenceSpan: Span | undefined;
  inferenceContext: OpenTelemetryContext | undefined;
  embedSpans: Map<string, { span: Span; context: OpenTelemetryContext }>;
  rerankSpan: { span: Span; context: OpenTelemetryContext } | undefined;
  toolSpans: Map<string, { span: Span; context: OpenTelemetryContext }>;
  settings: Record<string, unknown>;
  provider: string;
  modelId: string;
  runtimeContext: Record<string, unknown> | undefined;
  baseSupplementalAttributes: Attributes;
}

function msToSeconds(durationMs: number | undefined): number | undefined {
  return durationMs == null ? undefined : durationMs / 1000;
}

function getGenAIClientPerformanceAttributes(
  performance: LanguageModelCallEndEvent<ToolSet>['performance'],
): Attributes {
  return {
    'gen_ai.client.operation.duration': msToSeconds(performance.responseTimeMs),
    'gen_ai.client.operation.time_to_first_chunk': msToSeconds(
      performance.timeToFirstOutputMs,
    ),
    'gen_ai.client.operation.time_per_output_chunk': msToSeconds(
      performance.timeBetweenOutputChunksMs?.avg,
    ),
  };
}

export class OpenTelemetry implements Telemetry {
  private readonly callStates = new Map<string, CallState>();

  private readonly tracer: Tracer;
  private readonly supplementalAttributes: SupplementalAttributeOptions;
  private readonly enrichSpan: EnrichSpan | undefined;

  constructor(options: OpenTelemetryOptions = {}) {
    this.tracer = options.tracer ?? trace.getTracer('gen_ai');
    this.supplementalAttributes = normalizeSupplementalAttributes(options);
    this.enrichSpan = options.enrichSpan;
  }

  private getCallState(callId: string): CallState | undefined {
    return this.callStates.get(callId);
  }

  private cleanupCallState(callId: string): void {
    this.callStates.delete(callId);
  }

  private getSpanAttributes({
    attributes,
    spanType,
    operationId,
    callId,
    runtimeContext,
  }: {
    attributes: Attributes;
    spanType: OpenTelemetrySpanType;
    operationId: string;
    callId: string;
    runtimeContext: Record<string, unknown> | undefined;
  }): Attributes {
    let customAttributes: Attributes | undefined;

    try {
      customAttributes = this.enrichSpan?.({
        spanType,
        operationId,
        callId,
        runtimeContext,
      });
    } catch {
      customAttributes = undefined;
    }

    return {
      ...sanitizeAttributes(customAttributes),
      ...attributes,
    };
  }

  executeTool<T>({
    callId,
    toolCallId,
    execute,
  }: {
    callId: string;
    toolCallId: string;
    execute: () => PromiseLike<T>;
  }): PromiseLike<T> {
    const toolSpanEntry = this.getCallState(callId)?.toolSpans.get(toolCallId);

    if (toolSpanEntry == null) {
      return execute();
    }

    return context.with(toolSpanEntry.context, execute);
  }

  /**
   * Runs the provider `doGenerate`/`doStream` call with the active model-call
   * context.
   */
  executeLanguageModelCall<T>({
    callId,
    execute,
  }: {
    callId: string;
    execute: () => PromiseLike<T>;
  }): PromiseLike<T> {
    const state = this.getCallState(callId);
    const modelCallContext = state?.inferenceContext ?? state?.stepContext;

    if (modelCallContext == null) {
      return execute();
    }

    return context.with(modelCallContext, execute);
  }

  onStart(
    event:
      | InferTelemetryEvent<GenerateTextStartEvent>
      | InferTelemetryEvent<GenerateObjectStartEvent>
      | InferTelemetryEvent<EmbedStartEvent>
      | InferTelemetryEvent<RerankStartEvent>,
  ): void {
    if (
      event.operationId === 'ai.embed' ||
      event.operationId === 'ai.embedMany'
    ) {
      this.onEmbedOperationStart(event as InferTelemetryEvent<EmbedStartEvent>);
      return;
    }

    if (event.operationId === 'ai.rerank') {
      this.onRerankOperationStart(
        event as InferTelemetryEvent<RerankStartEvent>,
      );
      return;
    }

    if (
      event.operationId === 'ai.generateObject' ||
      event.operationId === 'ai.streamObject'
    ) {
      this.onObjectOperationStart(
        event as InferTelemetryEvent<GenerateObjectStartEvent>,
      );
      return;
    }

    this.onGenerateStart(event as InferTelemetryEvent<GenerateTextStartEvent>);
  }

  private onGenerateStart(
    event: InferTelemetryEvent<GenerateTextStartEvent>,
  ): void {
    const telemetry: TelemetryOptions = {
      recordInputs: event.recordInputs,
      recordOutputs: event.recordOutputs,
      functionId: event.functionId,
    };

    const settings: Record<string, unknown> = {
      maxOutputTokens: event.maxOutputTokens,
      temperature: event.temperature,
      topP: event.topP,
      topK: event.topK,
      presencePenalty: event.presencePenalty,
      frequencyPenalty: event.frequencyPenalty,
      stopSequences: event.stopSequences,
      seed: event.seed,
      maxRetries: event.maxRetries,
    };

    const providerName = mapProviderName(event.provider);
    const operationName = mapOperationName(event.operationId);
    const runtimeContext = event.runtimeContext as
      | Record<string, unknown>
      | undefined;
    const baseSupplementalAttributes = selectSupplementalAttributes(
      telemetry,
      this.supplementalAttributes,
      {
        runtimeContext: getRuntimeContextAttributes(runtimeContext),
        headers: getHeaderAttributes(event.headers),
      },
    );

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': operationName,
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      'gen_ai.agent.name': telemetry.functionId,
      'gen_ai.request.frequency_penalty': event.frequencyPenalty,
      'gen_ai.request.max_tokens': event.maxOutputTokens,
      'gen_ai.request.presence_penalty': event.presencePenalty,
      'gen_ai.request.temperature': (event.temperature ?? undefined) as
        | number
        | undefined,
      'gen_ai.request.top_k': event.topK,
      'gen_ai.request.top_p': event.topP,
      'gen_ai.request.stop_sequences': event.stopSequences,
      'gen_ai.request.seed': event.seed,
      'gen_ai.system_instructions': event.instructions
        ? {
            input: () =>
              JSON.stringify(formatSystemInstructions(event.instructions!)),
          }
        : undefined,
      'gen_ai.input.messages': {
        input: () =>
          JSON.stringify(
            formatModelMessages({
              prompt: undefined,
              messages: event.messages,
            }),
          ),
      },
      ...baseSupplementalAttributes,
    });

    const spanName = `${operationName} ${event.modelId}`;
    const rootSpan = this.tracer.startSpan(spanName, {
      attributes: this.getSpanAttributes({
        attributes,
        spanType: 'operation',
        operationId: event.operationId,
        callId: event.callId,
        runtimeContext,
      }),
      kind: SpanKind.INTERNAL,
    });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      inferenceSpan: undefined,
      inferenceContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      settings,
      provider: event.provider,
      modelId: event.modelId,
      runtimeContext,
      baseSupplementalAttributes,
    });
  }

  private onObjectOperationStart(
    event: InferTelemetryEvent<GenerateObjectStartEvent>,
  ): void {
    const telemetry: TelemetryOptions = {
      recordInputs: event.recordInputs,
      recordOutputs: event.recordOutputs,
      functionId: event.functionId,
    };

    const settings: Record<string, unknown> = {
      maxOutputTokens: event.maxOutputTokens,
      temperature: event.temperature,
      topP: event.topP,
      topK: event.topK,
      presencePenalty: event.presencePenalty,
      frequencyPenalty: event.frequencyPenalty,
      seed: event.seed,
      maxRetries: event.maxRetries,
    };

    const providerName = mapProviderName(event.provider);
    const operationName = mapOperationName(event.operationId);
    const baseSupplementalAttributes = selectSupplementalAttributes(
      telemetry,
      this.supplementalAttributes,
      {
        headers: getHeaderAttributes(event.headers),
      },
    );

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': operationName,
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      'gen_ai.agent.name': telemetry.functionId,
      'gen_ai.output.type': 'json',
      'gen_ai.request.frequency_penalty': event.frequencyPenalty,
      'gen_ai.request.max_tokens': event.maxOutputTokens,
      'gen_ai.request.presence_penalty': event.presencePenalty,
      'gen_ai.request.temperature': (event.temperature ?? undefined) as
        | number
        | undefined,
      'gen_ai.request.top_k': event.topK,
      'gen_ai.request.top_p': event.topP,
      'gen_ai.request.seed': event.seed,
      'gen_ai.system_instructions': event.system
        ? {
            input: () =>
              JSON.stringify(formatSystemInstructions(event.system!)),
          }
        : undefined,
      'gen_ai.input.messages': {
        input: () =>
          JSON.stringify(
            formatModelMessages({
              prompt: event.prompt,
              messages: event.messages,
            }),
          ),
      },
      ...baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        schema: {
          'ai.schema': event.schema
            ? { input: () => JSON.stringify(event.schema) }
            : undefined,
          'ai.schema.name': event.schemaName,
          'ai.schema.description': event.schemaDescription,
          'ai.settings.output': event.output,
        },
      }),
    });

    const spanName = `${operationName} ${event.modelId}`;
    const rootSpan = this.tracer.startSpan(spanName, {
      attributes: this.getSpanAttributes({
        attributes,
        spanType: 'operation',
        operationId: event.operationId,
        callId: event.callId,
        runtimeContext: undefined,
      }),
      kind: SpanKind.INTERNAL,
    });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      inferenceSpan: undefined,
      inferenceContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      settings,
      provider: event.provider,
      modelId: event.modelId,
      runtimeContext: undefined,
      baseSupplementalAttributes,
    });
  }

  /** @deprecated */
  onObjectStepStart(event: GenerateObjectStepStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;
    const providerName = mapProviderName(event.provider);

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      'gen_ai.output.type': 'json',
      'gen_ai.request.frequency_penalty': state.settings.frequencyPenalty as
        | number
        | undefined,
      'gen_ai.request.max_tokens': state.settings.maxOutputTokens as
        | number
        | undefined,
      'gen_ai.request.presence_penalty': state.settings.presencePenalty as
        | number
        | undefined,
      'gen_ai.request.temperature': (state.settings.temperature ?? undefined) as
        | number
        | undefined,
      'gen_ai.request.top_k': state.settings.topK as number | undefined,
      'gen_ai.request.top_p': state.settings.topP as number | undefined,
      'gen_ai.input.messages': {
        input: () =>
          event.promptMessages
            ? JSON.stringify(formatInputMessages(event.promptMessages))
            : undefined,
      },
      ...state.baseSupplementalAttributes,
    });

    const spanName = `chat ${event.modelId}`;
    state.inferenceSpan = this.tracer.startSpan(
      spanName,
      {
        attributes: this.getSpanAttributes({
          attributes,
          spanType: 'languageModel',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.CLIENT,
      },
      state.rootContext,
    );
    state.inferenceContext = trace.setSpan(
      state.rootContext,
      state.inferenceSpan,
    );
  }

  /** @deprecated */
  onObjectStepEnd(event: GenerateObjectStepEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.inferenceSpan) return;

    const { telemetry } = state;

    state.inferenceSpan.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.response.id': event.response.id,
        'gen_ai.response.model': event.response.modelId,
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
        'gen_ai.usage.cache_read.input_tokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'gen_ai.output.messages': {
          output: () => {
            try {
              return JSON.stringify(
                formatObjectOutputMessages({
                  objectText: event.objectText,
                  finishReason: event.finishReason,
                }),
              );
            } catch {
              return event.objectText;
            }
          },
        },
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            providerMetadata: {
              'ai.response.providerMetadata': event.providerMetadata
                ? JSON.stringify(event.providerMetadata)
                : undefined,
            },
            usage: getDetailedUsageAttributes(event.usage),
          },
        ),
      }),
    );

    state.inferenceSpan.end();
    state.inferenceSpan = undefined;
    state.inferenceContext = undefined;
  }

  private onEmbedOperationStart(
    event: InferTelemetryEvent<EmbedStartEvent>,
  ): void {
    const telemetry: TelemetryOptions = {
      recordInputs: event.recordInputs,
      recordOutputs: event.recordOutputs,
      functionId: event.functionId,
    };

    const providerName = mapProviderName(event.provider);
    const baseSupplementalAttributes = selectSupplementalAttributes(
      telemetry,
      this.supplementalAttributes,
      {
        headers: getHeaderAttributes(event.headers),
      },
    );
    const value = event.value;
    const isMany = event.operationId === 'ai.embedMany';

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'embeddings',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      ...baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        embedding: isMany
          ? {
              'ai.values': {
                input: () => (value as string[]).map(v => JSON.stringify(v)),
              },
            }
          : {
              'ai.value': {
                input: () => JSON.stringify(value),
              },
            },
      }),
    });

    const spanName = `embeddings ${event.modelId}`;
    const rootSpan = this.tracer.startSpan(spanName, {
      attributes: this.getSpanAttributes({
        attributes,
        spanType: 'operation',
        operationId: event.operationId,
        callId: event.callId,
        runtimeContext: undefined,
      }),
      kind: SpanKind.CLIENT,
    });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      inferenceSpan: undefined,
      inferenceContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      settings: { maxRetries: event.maxRetries },
      provider: event.provider,
      modelId: event.modelId,
      runtimeContext: undefined,
      baseSupplementalAttributes,
    });
  }

  onStepStart(event: OtelStepStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;
    state.runtimeContext = event.runtimeContext as
      | Record<string, unknown>
      | undefined;
    const stepAttributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'agent_step',
      ...state.baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        toolChoice: {
          'ai.prompt.toolChoice': {
            input: () =>
              event.stepToolChoice != null
                ? JSON.stringify(event.stepToolChoice)
                : undefined,
          },
        },
      }),
    });

    state.stepSpan = this.tracer.startSpan(
      `step ${event.steps.length + 1}`,
      {
        attributes: this.getSpanAttributes({
          attributes: stepAttributes,
          spanType: 'step',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.INTERNAL,
      },
      state.rootContext,
    );
    state.stepContext = trace.setSpan(state.rootContext, state.stepSpan);
  }

  onLanguageModelCallStart(event: LanguageModelCallStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepContext) return;

    const { telemetry } = state;
    const providerName = mapProviderName(event.provider);

    const inferenceAttributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      'gen_ai.request.frequency_penalty': state.settings.frequencyPenalty as
        | number
        | undefined,
      'gen_ai.request.max_tokens': state.settings.maxOutputTokens as
        | number
        | undefined,
      'gen_ai.request.presence_penalty': state.settings.presencePenalty as
        | number
        | undefined,
      'gen_ai.request.stop_sequences': state.settings.stopSequences as
        | string[]
        | undefined,
      'gen_ai.request.temperature': (state.settings.temperature ?? undefined) as
        | number
        | undefined,
      'gen_ai.request.top_k': state.settings.topK as number | undefined,
      'gen_ai.request.top_p': state.settings.topP as number | undefined,
      'gen_ai.input.messages': {
        input: () => {
          const formattedMessages = formatModelMessages({
            prompt: undefined,
            messages: event.messages,
          });

          return formattedMessages.length > 0
            ? JSON.stringify(formattedMessages)
            : undefined;
        },
      },
      'gen_ai.tool.definitions': {
        input: () => (event.tools ? JSON.stringify(event.tools) : undefined),
      },
    });

    state.inferenceSpan = this.tracer.startSpan(
      `chat ${event.modelId}`,
      {
        attributes: this.getSpanAttributes({
          attributes: inferenceAttributes,
          spanType: 'languageModel',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.CLIENT,
      },
      state.stepContext,
    );
    state.inferenceContext = trace.setSpan(
      state.stepContext,
      state.inferenceSpan,
    );
  }

  onLanguageModelCallEnd(event: LanguageModelCallEndEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.inferenceSpan) return;

    const { telemetry } = state;

    state.inferenceSpan.setAttributes(
      selectAttributes(telemetry, {
        ...getGenAIClientPerformanceAttributes(event.performance),
        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.response.id': event.responseId,
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
        'gen_ai.usage.cache_read.input_tokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'gen_ai.usage.cache_creation.input_tokens':
          event.usage.inputTokenDetails?.cacheWriteTokens,
        'gen_ai.output.messages': {
          output: () =>
            JSON.stringify(
              formatOutputMessages({
                text:
                  event.content
                    .filter(p => p.type === 'text')
                    .map(p => p.text)
                    .join('') || undefined,
                reasoning: event.content.filter(p => p.type === 'reasoning'),
                toolCalls: event.content.filter(p => p.type === 'tool-call'),
                files: event.content
                  .filter(p => p.type === 'file')
                  .map(p => p.file),
                finishReason: event.finishReason,
              }),
            ),
        },
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            usage: getDetailedUsageAttributes(event.usage),
          },
        ),
      }),
    );

    state.inferenceSpan.end();
    state.inferenceSpan = undefined;
    state.inferenceContext = undefined;
  }

  onToolExecutionStart(event: ToolExecutionStartEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepContext) return;

    const { telemetry } = state;
    const { toolCall } = event;

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': toolCall.toolName,
      'gen_ai.tool.call.id': toolCall.toolCallId,
      'gen_ai.tool.type': 'function',
      'gen_ai.tool.call.arguments': {
        input: () => JSON.stringify(toolCall.input),
      },
    });

    const spanName = `execute_tool ${toolCall.toolName}`;
    const toolSpan = this.tracer.startSpan(
      spanName,
      {
        attributes: this.getSpanAttributes({
          attributes,
          spanType: 'tool',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.INTERNAL,
      },
      state.stepContext,
    );
    const toolContext = trace.setSpan(state.stepContext, toolSpan);

    state.toolSpans.set(toolCall.toolCallId, {
      span: toolSpan,
      context: toolContext,
    });
  }

  onToolExecutionEnd(event: ToolExecutionEndEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state) return;

    const toolSpanEntry = state.toolSpans.get(event.toolCall.toolCallId);
    if (!toolSpanEntry) return;

    const { span } = toolSpanEntry;
    const { telemetry } = state;

    const { toolOutput } = event;
    span.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.execute_tool.duration': msToSeconds(event.toolExecutionMs),
      }),
    );

    if (toolOutput.type === 'tool-result') {
      try {
        span.setAttributes(
          selectAttributes(telemetry, {
            'gen_ai.tool.call.result': {
              output: () => JSON.stringify(toolOutput.output),
            },
          }),
        );
      } catch {
        // JSON.stringify might fail for non-serializable results
      }
    } else {
      recordErrorOnSpan(span, toolOutput.error);
    }

    span.end();
    state.toolSpans.delete(event.toolCall.toolCallId);
  }

  onStepEnd(event: GenerateTextStepEndEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepSpan) return;

    const { telemetry } = state;

    state.stepSpan.setAttributes(
      selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        providerMetadata: {
          'ai.response.providerMetadata': event.providerMetadata
            ? JSON.stringify(event.providerMetadata)
            : undefined,
        },
        usage: getDetailedUsageAttributes(event.usage),
      }),
    );

    state.stepSpan.end();
    state.stepSpan = undefined;
    state.stepContext = undefined;
  }

  /** @deprecated Use `onStepEnd` instead. */
  onStepFinish(event: GenerateTextStepEndEvent<ToolSet>): void {
    this.onStepEnd(event);
  }

  onEnd(
    event:
      | GenerateTextEndEvent<ToolSet>
      | GenerateObjectEndEvent<unknown>
      | EmbedEndEvent
      | RerankEndEvent,
  ): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    if (
      state.operationId === 'ai.embed' ||
      state.operationId === 'ai.embedMany'
    ) {
      this.onEmbedOperationEnd(event as EmbedEndEvent);
      return;
    }

    if (state.operationId === 'ai.rerank') {
      this.onRerankOperationEnd(event as RerankEndEvent);
      return;
    }

    if (
      state.operationId === 'ai.generateObject' ||
      state.operationId === 'ai.streamObject'
    ) {
      this.onObjectOperationEnd(event as GenerateObjectEndEvent<unknown>);
      return;
    }

    this.onGenerateEnd(event as GenerateTextEndEvent<ToolSet>);
  }

  private onGenerateEnd(event: GenerateTextEndEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    const { telemetry } = state;

    state.rootSpan.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
        'gen_ai.usage.cache_read.input_tokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'gen_ai.usage.cache_creation.input_tokens':
          event.usage.inputTokenDetails?.cacheWriteTokens,
        'gen_ai.output.messages': {
          output: () =>
            JSON.stringify(
              formatOutputMessages({
                text: event.text ?? undefined,
                reasoning: event.finalStep.reasoning as ReadonlyArray<{
                  text?: string;
                }>,
                toolCalls: event.toolCalls,
                files: event.files,
                finishReason: event.finishReason,
              }),
            ),
        },
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            providerMetadata: {
              'ai.response.providerMetadata': event.finalStep.providerMetadata
                ? JSON.stringify(event.finalStep.providerMetadata)
                : undefined,
            },
            usage: getDetailedUsageAttributes(event.usage),
          },
        ),
      }),
    );

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  private onObjectOperationEnd(event: GenerateObjectEndEvent<unknown>): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    const { telemetry } = state;

    state.rootSpan.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
        'gen_ai.usage.cache_read.input_tokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'gen_ai.output.messages': {
          output: () =>
            event.object != null
              ? JSON.stringify(
                  formatObjectOutputMessages({
                    objectText: JSON.stringify(event.object),
                    finishReason: event.finishReason,
                  }),
                )
              : undefined,
        },
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            providerMetadata: {
              'ai.response.providerMetadata': event.providerMetadata
                ? JSON.stringify(event.providerMetadata)
                : undefined,
            },
            usage: getDetailedUsageAttributes(event.usage),
          },
        ),
      }),
    );

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  private onEmbedOperationEnd(event: EmbedEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    const { telemetry } = state;
    const isMany = state.operationId === 'ai.embedMany';

    state.rootSpan.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.usage.input_tokens': event.usage.tokens,
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            embedding: isMany
              ? {
                  'ai.embeddings': {
                    output: () =>
                      (event.embedding as number[][]).map(e =>
                        JSON.stringify(e),
                      ),
                  },
                }
              : {
                  'ai.embedding': {
                    output: () => JSON.stringify(event.embedding),
                  },
                },
          },
        ),
      }),
    );

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  onEmbedStart(event: EmbeddingModelCallStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;
    const providerName = mapProviderName(state.provider);

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'embeddings',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': state.modelId,
      ...state.baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        embedding: {
          'ai.values': {
            input: () => event.values.map(v => JSON.stringify(v)),
          },
        },
      }),
    });

    const spanName = `embeddings ${state.modelId}`;
    const embedSpan = this.tracer.startSpan(
      spanName,
      {
        attributes: this.getSpanAttributes({
          attributes,
          spanType: 'embedding',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.CLIENT,
      },
      state.rootContext,
    );
    const embedContext = trace.setSpan(state.rootContext, embedSpan);

    state.embedSpans.set(event.embedCallId, {
      span: embedSpan,
      context: embedContext,
    });
  }

  onEmbedEnd(event: EmbeddingModelCallEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state) return;

    const embedSpanEntry = state.embedSpans.get(event.embedCallId);
    if (!embedSpanEntry) return;

    const { span } = embedSpanEntry;
    const { telemetry } = state;

    span.setAttributes(
      selectAttributes(telemetry, {
        'gen_ai.usage.input_tokens': event.usage.tokens,
        ...selectSupplementalAttributes(
          telemetry,
          this.supplementalAttributes,
          {
            embedding: {
              'ai.embeddings': {
                output: () =>
                  event.embeddings.map(embedding => JSON.stringify(embedding)),
              },
            },
          },
        ),
      }),
    );

    span.end();
    state.embedSpans.delete(event.embedCallId);
  }

  private onRerankOperationStart(
    event: InferTelemetryEvent<RerankStartEvent>,
  ): void {
    const telemetry: TelemetryOptions = {
      recordInputs: event.recordInputs,
      recordOutputs: event.recordOutputs,
      functionId: event.functionId,
    };

    const providerName = mapProviderName(event.provider);
    const baseSupplementalAttributes = selectSupplementalAttributes(
      telemetry,
      this.supplementalAttributes,
      {
        headers: getHeaderAttributes(event.headers),
      },
    );

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'rerank',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': event.modelId,
      ...baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        reranking: {
          'ai.documents': {
            input: () => event.documents.map(d => JSON.stringify(d)),
          },
        },
      }),
    });

    const spanName = `rerank ${event.modelId}`;
    const rootSpan = this.tracer.startSpan(spanName, {
      attributes: this.getSpanAttributes({
        attributes,
        spanType: 'operation',
        operationId: event.operationId,
        callId: event.callId,
        runtimeContext: undefined,
      }),
      kind: SpanKind.CLIENT,
    });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      inferenceSpan: undefined,
      inferenceContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      settings: { maxRetries: event.maxRetries },
      provider: event.provider,
      modelId: event.modelId,
      runtimeContext: undefined,
      baseSupplementalAttributes,
    });
  }

  private onRerankOperationEnd(event: RerankEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  onRerankStart(event: RerankingModelCallStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;
    const providerName = mapProviderName(state.provider);

    const attributes = selectAttributes(telemetry, {
      'gen_ai.operation.name': 'rerank',
      'gen_ai.provider.name': providerName,
      'gen_ai.request.model': state.modelId,
      ...state.baseSupplementalAttributes,
      ...selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        reranking: {
          'ai.documents': {
            input: () => event.documents.map(d => JSON.stringify(d)),
          },
        },
      }),
    });

    const spanName = `rerank ${state.modelId}`;
    const rerankSpan = this.tracer.startSpan(
      spanName,
      {
        attributes: this.getSpanAttributes({
          attributes,
          spanType: 'reranking',
          operationId: state.operationId,
          callId: event.callId,
          runtimeContext: state.runtimeContext,
        }),
        kind: SpanKind.CLIENT,
      },
      state.rootContext,
    );
    const rerankContext = trace.setSpan(state.rootContext, rerankSpan);

    state.rerankSpan = { span: rerankSpan, context: rerankContext };
  }

  onRerankEnd(event: RerankingModelCallEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rerankSpan) return;

    const { span } = state.rerankSpan;
    const { telemetry } = state;

    span.setAttributes(
      selectSupplementalAttributes(telemetry, this.supplementalAttributes, {
        reranking: {
          'ai.ranking.type': event.documentsType,
          'ai.ranking': {
            output: () => event.ranking.map(r => JSON.stringify(r)),
          },
        },
      }),
    );

    span.end();
    state.rerankSpan = undefined;
  }

  onAbort(event: GenerateTextAbortEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    for (const { span: toolSpan } of state.toolSpans.values()) {
      toolSpan.end();
    }
    state.toolSpans.clear();

    if (state.inferenceSpan) {
      state.inferenceSpan.end();
      state.inferenceSpan = undefined;
      state.inferenceContext = undefined;
    }

    if (state.stepSpan) {
      state.stepSpan.end();
      state.stepSpan = undefined;
      state.stepContext = undefined;
    }

    for (const { span: embedSpan } of state.embedSpans.values()) {
      embedSpan.end();
    }
    state.embedSpans.clear();

    if (state.rerankSpan) {
      state.rerankSpan.span.end();
      state.rerankSpan = undefined;
    }

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  onError(error: unknown): void {
    const event = error as { callId?: string; error?: unknown };
    if (!event?.callId) return;

    const state = this.getCallState(event.callId);
    if (!state?.rootSpan) return;

    const actualError = event.error ?? error;

    for (const { span: toolSpan } of state.toolSpans.values()) {
      recordErrorOnSpan(toolSpan, actualError);
      toolSpan.end();
    }
    state.toolSpans.clear();

    if (state.inferenceSpan) {
      recordErrorOnSpan(state.inferenceSpan, actualError);
      state.inferenceSpan.end();
      state.inferenceSpan = undefined;
      state.inferenceContext = undefined;
    }

    if (state.stepSpan) {
      recordErrorOnSpan(state.stepSpan, actualError);
      state.stepSpan.end();
      state.stepSpan = undefined;
      state.stepContext = undefined;
    }

    for (const { span: embedSpan } of state.embedSpans.values()) {
      recordErrorOnSpan(embedSpan, actualError);
      embedSpan.end();
    }
    state.embedSpans.clear();

    if (state.rerankSpan) {
      recordErrorOnSpan(state.rerankSpan.span, actualError);
      state.rerankSpan.span.end();
      state.rerankSpan = undefined;
    }

    recordErrorOnSpan(state.rootSpan, actualError);

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }
}
