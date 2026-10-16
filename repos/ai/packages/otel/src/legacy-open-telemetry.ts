import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import type { Context as AISDKContext } from '@ai-sdk/provider-utils';
import {
  context,
  SpanStatusCode,
  trace,
  type Attributes,
  type AttributeValue,
  type Context as OpenTelemetryContext,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import type {
  EmbeddingModelCallEndEvent,
  EmbedEndEvent,
  EmbedStartEvent,
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
  Output,
  RerankingModelCallEndEvent,
  RerankEndEvent,
  RerankStartEvent,
  RerankingModelCallStartEvent,
  InferTelemetryEvent,
  Telemetry,
  TelemetryOptions,
  ToolSet,
} from 'ai';
import { assembleOperationName } from './assemble-operation-name';
import { getBaseTelemetryAttributes } from './get-base-telemetry-attributes';
import { sanitizeAttributeValue } from './sanitize-attribute-value';
import { stringifyForTelemetry } from './stringify-for-telemetry';

function recordSpanError(span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  } else {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}

function shouldRecord(
  telemetry: TelemetryOptions | undefined,
): telemetry is TelemetryOptions {
  return telemetry?.isEnabled !== false;
}

function selectAttributes(
  telemetry: TelemetryOptions | undefined,
  attributes: Record<
    string,
    | AttributeValue
    | { input: () => AttributeValue | undefined }
    | { output: () => AttributeValue | undefined }
    | undefined
  >,
): Attributes {
  if (!shouldRecord(telemetry)) {
    return {};
  }

  const result: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value == null) continue;

    if (
      typeof value === 'object' &&
      'input' in value &&
      typeof value.input === 'function'
    ) {
      if (telemetry?.recordInputs === false) continue;
      const resolved = value.input();
      if (resolved != null) {
        const sanitized = sanitizeAttributeValue(resolved);
        if (sanitized != null) result[key] = sanitized;
      }
      continue;
    }

    if (
      typeof value === 'object' &&
      'output' in value &&
      typeof value.output === 'function'
    ) {
      if (telemetry?.recordOutputs === false) continue;
      const resolved = value.output();
      if (resolved != null) {
        const sanitized = sanitizeAttributeValue(resolved);
        if (sanitized != null) result[key] = sanitized;
      }
      continue;
    }

    const sanitized = sanitizeAttributeValue(value as AttributeValue);
    if (sanitized != null) result[key] = sanitized;
  }

  return result;
}

interface OtelStepStartEvent<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends AISDKContext = AISDKContext,
  OUTPUT extends Output.Output = Output.Output,
> extends GenerateTextStepStartEvent<TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  readonly promptMessages?: LanguageModelV4Prompt;
  readonly stepTools?: ReadonlyArray<Record<string, unknown>>;
  readonly stepToolChoice?: unknown;
}

interface CallState {
  operationId: string;
  telemetry: TelemetryOptions | undefined;
  rootSpan: Span | undefined;
  rootContext: OpenTelemetryContext | undefined;
  stepSpan: Span | undefined;
  stepContext: OpenTelemetryContext | undefined;
  embedSpans: Map<string, { span: Span; context: OpenTelemetryContext }>;
  rerankSpan: { span: Span; context: OpenTelemetryContext } | undefined;
  toolSpans: Map<string, { span: Span; context: OpenTelemetryContext }>;
  baseTelemetryAttributes: Attributes;
  settings: Record<string, unknown>;
}

export class LegacyOpenTelemetry implements Telemetry {
  private readonly callStates = new Map<string, CallState>();

  /**
   * The tracer to use for the telemetry data.
   */
  private readonly tracer: Tracer;

  constructor(
    options: {
      tracer?: Tracer;
    } = {},
  ) {
    this.tracer = options.tracer ?? trace.getTracer('ai');
  }

  private getCallState(callId: string): CallState | undefined {
    return this.callStates.get(callId);
  }

  private cleanupCallState(callId: string): void {
    this.callStates.delete(callId);
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
   * Runs the provider `doGenerate`/`doStream` call with the active legacy
   * model-call context.
   */
  executeLanguageModelCall<T>({
    callId,
    execute,
  }: {
    callId: string;
    execute: () => PromiseLike<T>;
  }): PromiseLike<T> {
    const stepContext = this.getCallState(callId)?.stepContext;

    if (stepContext == null) {
      return execute();
    }

    return context.with(stepContext, execute);
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

    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model: { provider: event.provider, modelId: event.modelId },
      headers: event.headers,
      settings,
      context: event.runtimeContext as Record<string, unknown> | undefined,
    });

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...baseTelemetryAttributes,
      'ai.model.provider': event.provider,
      'ai.model.id': event.modelId,
      'ai.prompt': {
        input: () =>
          JSON.stringify({
            system: event.instructions,
            messages: event.messages,
          }),
      },
    });

    const rootSpan = this.tracer.startSpan(event.operationId, { attributes });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      baseTelemetryAttributes,
      settings,
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

    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model: { provider: event.provider, modelId: event.modelId },
      headers: event.headers,
      settings,
      context: undefined,
    });

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...baseTelemetryAttributes,
      'ai.prompt': {
        input: () =>
          JSON.stringify({
            system: event.system,
            prompt: event.prompt,
            messages: event.messages,
          }),
      },
      'ai.schema': event.schema
        ? { input: () => JSON.stringify(event.schema) }
        : undefined,
      'ai.schema.name': event.schemaName,
      'ai.schema.description': event.schemaDescription,
      'ai.settings.output': event.output,
    });

    const rootSpan = this.tracer.startSpan(event.operationId, { attributes });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      baseTelemetryAttributes,
      settings,
    });
  }

  /** @deprecated */
  onObjectStepStart(event: GenerateObjectStepStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;

    const stepOperationId =
      state.operationId === 'ai.streamObject'
        ? 'ai.streamObject.doStream'
        : 'ai.generateObject.doGenerate';

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: stepOperationId,
        telemetry,
      }),
      ...state.baseTelemetryAttributes,
      'ai.prompt.messages': {
        input: () =>
          event.promptMessages
            ? stringifyForTelemetry(event.promptMessages)
            : undefined,
      },

      'gen_ai.system': event.provider,
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
      'gen_ai.request.temperature': (state.settings.temperature ?? undefined) as
        | number
        | undefined,
      'gen_ai.request.top_k': state.settings.topK as number | undefined,
      'gen_ai.request.top_p': state.settings.topP as number | undefined,
    });

    state.stepSpan = this.tracer.startSpan(
      stepOperationId,
      { attributes },
      state.rootContext,
    );
    state.stepContext = trace.setSpan(state.rootContext, state.stepSpan);
  }

  /** @deprecated */
  onObjectStepEnd(event: GenerateObjectStepEndEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepSpan) return;

    const { telemetry } = state;

    state.stepSpan.setAttributes(
      selectAttributes(telemetry, {
        'ai.response.finishReason': event.finishReason,
        'ai.response.object': {
          output: () => {
            try {
              return JSON.stringify(JSON.parse(event.objectText));
            } catch {
              return event.objectText;
            }
          },
        },
        'ai.response.id': event.response.id,
        'ai.response.model': event.response.modelId,
        'ai.response.timestamp': event.response.timestamp.toISOString(),
        'ai.response.providerMetadata': event.providerMetadata
          ? JSON.stringify(event.providerMetadata)
          : undefined,

        'ai.usage.inputTokens': event.usage.inputTokens,
        'ai.usage.outputTokens': event.usage.outputTokens,
        'ai.usage.totalTokens': event.usage.totalTokens,
        'ai.usage.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,
        'ai.usage.cachedInputTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,

        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.response.id': event.response.id,
        'gen_ai.response.model': event.response.modelId,
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
      }),
    );

    if (event.msToFirstChunk != null) {
      state.stepSpan.addEvent('ai.stream.firstChunk', {
        'ai.stream.msToFirstChunk': event.msToFirstChunk,
      });
      state.stepSpan.setAttributes({
        'ai.stream.msToFirstChunk': event.msToFirstChunk,
      });
    }

    state.stepSpan.end();
    state.stepSpan = undefined;
    state.stepContext = undefined;
  }

  private onEmbedOperationStart(
    event: InferTelemetryEvent<EmbedStartEvent>,
  ): void {
    const telemetry: TelemetryOptions = {
      recordInputs: event.recordInputs,
      recordOutputs: event.recordOutputs,
      functionId: event.functionId,
    };

    const settings: Record<string, unknown> = {
      maxRetries: event.maxRetries,
    };

    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model: { provider: event.provider, modelId: event.modelId },
      headers: event.headers,
      settings,
      context: undefined,
    });

    const value = event.value;
    const isMany = event.operationId === 'ai.embedMany';

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...baseTelemetryAttributes,
      ...(isMany
        ? {
            'ai.values': {
              input: () => (value as string[]).map(v => JSON.stringify(v)),
            },
          }
        : {
            'ai.value': {
              input: () => JSON.stringify(value),
            },
          }),
    });

    const rootSpan = this.tracer.startSpan(event.operationId, { attributes });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      baseTelemetryAttributes,
      settings,
    });
  }

  onStepStart(event: OtelStepStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;

    const stepOperationId =
      state.operationId === 'ai.streamText'
        ? 'ai.streamText.doStream'
        : 'ai.generateText.doGenerate';

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: stepOperationId,
        telemetry,
      }),
      ...state.baseTelemetryAttributes,
      'ai.model.provider': event.provider,
      'ai.model.id': event.modelId,

      'ai.prompt.messages': {
        input: () =>
          event.promptMessages
            ? stringifyForTelemetry(event.promptMessages)
            : undefined,
      },
      'ai.prompt.tools': {
        input: () => event.stepTools?.map(tool => JSON.stringify(tool)),
      },
      'ai.prompt.toolChoice': {
        input: () =>
          event.stepToolChoice != null
            ? JSON.stringify(event.stepToolChoice)
            : undefined,
      },

      'gen_ai.system': event.provider,
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
    });

    state.stepSpan = this.tracer.startSpan(
      stepOperationId,
      { attributes },
      state.rootContext,
    );
    state.stepContext = trace.setSpan(state.rootContext, state.stepSpan);
  }

  onToolExecutionStart(event: ToolExecutionStartEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepContext) return;

    const { telemetry } = state;
    const { toolCall } = event;

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: 'ai.toolCall',
        telemetry,
      }),
      'ai.toolCall.name': toolCall.toolName,
      'ai.toolCall.id': toolCall.toolCallId,
      'ai.toolCall.args': {
        output: () => JSON.stringify(toolCall.input),
      },
    });

    const toolSpan = this.tracer.startSpan(
      'ai.toolCall',
      { attributes },
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
    if (toolOutput.type === 'tool-result') {
      try {
        span.setAttributes(
          selectAttributes(telemetry, {
            'ai.toolCall.result': {
              output: () => JSON.stringify(toolOutput.output),
            },
          }),
        );
      } catch {
        // JSON.stringify might fail for non-serializable results
      }
    } else {
      recordSpanError(span, toolOutput.error);
    }

    span.end();
    state.toolSpans.delete(event.toolCall.toolCallId);
  }

  onStepEnd(event: GenerateTextStepEndEvent<ToolSet>): void {
    const state = this.getCallState(event.callId);
    if (!state?.stepSpan) return;

    const { telemetry } = state;
    const isStreamText = state.operationId === 'ai.streamText';

    state.stepSpan.setAttributes(
      selectAttributes(telemetry, {
        'ai.response.finishReason': event.finishReason,
        'ai.response.text': {
          output: () => event.text ?? undefined,
        },
        'ai.response.reasoning': {
          output: () =>
            event.reasoning.length > 0
              ? event.reasoning
                  .filter(part => 'text' in part)
                  .map(part => part.text)
                  .join('\n')
              : undefined,
        },
        'ai.response.toolCalls': {
          output: () =>
            event.toolCalls.length > 0
              ? JSON.stringify(
                  event.toolCalls.map(toolCall => ({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  })),
                )
              : undefined,
        },
        'ai.response.files': {
          output: () =>
            event.files.length > 0
              ? JSON.stringify(
                  event.files.map(file => ({
                    type: 'file',
                    mediaType: file.mediaType,
                    data: file.base64,
                  })),
                )
              : undefined,
        },
        'ai.response.id': event.response.id,
        'ai.response.model': event.response.modelId,
        'ai.response.timestamp': event.response.timestamp.toISOString(),
        'ai.response.providerMetadata': event.providerMetadata
          ? JSON.stringify(event.providerMetadata)
          : undefined,
        'ai.response.msToFirstChunk': isStreamText
          ? event.performance.timeToFirstOutputMs
          : undefined,
        'ai.response.msToFinish': isStreamText
          ? event.performance.responseTimeMs
          : undefined,
        'ai.response.avgOutputTokensPerSecond': isStreamText
          ? event.performance.effectiveOutputTokensPerSecond
          : undefined,

        'ai.usage.inputTokens': event.usage.inputTokens,
        'ai.usage.outputTokens': event.usage.outputTokens,
        'ai.usage.totalTokens': event.usage.totalTokens,
        'ai.usage.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,
        'ai.usage.cachedInputTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'ai.usage.inputTokenDetails.noCacheTokens':
          event.usage.inputTokenDetails?.noCacheTokens,
        'ai.usage.inputTokenDetails.cacheReadTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'ai.usage.inputTokenDetails.cacheWriteTokens':
          event.usage.inputTokenDetails?.cacheWriteTokens,
        'ai.usage.outputTokenDetails.textTokens':
          event.usage.outputTokenDetails?.textTokens,
        'ai.usage.outputTokenDetails.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,

        'gen_ai.response.finish_reasons': [event.finishReason],
        'gen_ai.response.id': event.response.id,
        'gen_ai.response.model': event.response.modelId,
        'gen_ai.usage.input_tokens': event.usage.inputTokens,
        'gen_ai.usage.output_tokens': event.usage.outputTokens,
      }),
    );

    if (isStreamText && event.performance.timeToFirstOutputMs != null) {
      state.stepSpan.addEvent('ai.stream.firstChunk', {
        'ai.response.msToFirstChunk': event.performance.timeToFirstOutputMs,
      });
    }

    if (isStreamText) {
      state.stepSpan.addEvent('ai.stream.finish', {
        'ai.response.msToFinish': event.performance.responseTimeMs,
        'ai.response.avgOutputTokensPerSecond':
          event.performance.effectiveOutputTokensPerSecond,
      });
    }

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
        'ai.response.finishReason': event.finishReason,
        'ai.response.text': {
          output: () => event.text ?? undefined,
        },
        'ai.response.reasoning': {
          output: () =>
            event.finalStep.reasoning.length > 0
              ? event.finalStep.reasoning
                  .filter(part => 'text' in part)
                  .map(part => part.text)
                  .join('\n')
              : undefined,
        },
        'ai.response.toolCalls': {
          output: () =>
            event.toolCalls.length > 0
              ? JSON.stringify(
                  event.toolCalls.map(toolCall => ({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  })),
                )
              : undefined,
        },
        'ai.response.files': {
          output: () =>
            event.files.length > 0
              ? JSON.stringify(
                  event.files.map(file => ({
                    type: 'file',
                    mediaType: file.mediaType,
                    data: file.base64,
                  })),
                )
              : undefined,
        },
        'ai.response.providerMetadata': event.finalStep.providerMetadata
          ? JSON.stringify(event.finalStep.providerMetadata)
          : undefined,

        'ai.usage.inputTokens': event.usage.inputTokens,
        'ai.usage.outputTokens': event.usage.outputTokens,
        'ai.usage.totalTokens': event.usage.totalTokens,
        'ai.usage.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,
        'ai.usage.cachedInputTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'ai.usage.inputTokenDetails.noCacheTokens':
          event.usage.inputTokenDetails?.noCacheTokens,
        'ai.usage.inputTokenDetails.cacheReadTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
        'ai.usage.inputTokenDetails.cacheWriteTokens':
          event.usage.inputTokenDetails?.cacheWriteTokens,
        'ai.usage.outputTokenDetails.textTokens':
          event.usage.outputTokenDetails?.textTokens,
        'ai.usage.outputTokenDetails.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,
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
        'ai.response.finishReason': event.finishReason,
        'ai.response.object': {
          output: () =>
            event.object != null ? JSON.stringify(event.object) : undefined,
        },
        'ai.response.providerMetadata': event.providerMetadata
          ? JSON.stringify(event.providerMetadata)
          : undefined,

        'ai.usage.inputTokens': event.usage.inputTokens,
        'ai.usage.outputTokens': event.usage.outputTokens,
        'ai.usage.totalTokens': event.usage.totalTokens,
        'ai.usage.reasoningTokens':
          event.usage.outputTokenDetails?.reasoningTokens,
        'ai.usage.cachedInputTokens':
          event.usage.inputTokenDetails?.cacheReadTokens,
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
        ...(isMany
          ? {
              'ai.embeddings': {
                output: () =>
                  (event.embedding as number[][]).map(e => JSON.stringify(e)),
              },
            }
          : {
              'ai.embedding': {
                output: () => JSON.stringify(event.embedding),
              },
            }),
        'ai.usage.tokens': event.usage.tokens,
      }),
    );

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }

  onEmbedStart(event: EmbeddingModelCallStartEvent): void {
    const state = this.getCallState(event.callId);
    if (!state?.rootSpan || !state.rootContext) return;

    const { telemetry } = state;

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...state.baseTelemetryAttributes,
      'ai.values': {
        input: () => event.values.map(v => JSON.stringify(v)),
      },
    });

    const embedSpan = this.tracer.startSpan(
      event.operationId,
      { attributes },
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
        'ai.embeddings': {
          output: () =>
            event.embeddings.map(embedding => JSON.stringify(embedding)),
        },
        'ai.usage.tokens': event.usage.tokens,
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

    const settings: Record<string, unknown> = {
      maxRetries: event.maxRetries,
    };

    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model: { provider: event.provider, modelId: event.modelId },
      headers: event.headers,
      settings,
      context: undefined,
    });

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...baseTelemetryAttributes,
      'ai.documents': {
        input: () => event.documents.map(d => JSON.stringify(d)),
      },
    });

    const rootSpan = this.tracer.startSpan(event.operationId, { attributes });
    const rootContext = trace.setSpan(context.active(), rootSpan);

    this.callStates.set(event.callId, {
      operationId: event.operationId,
      telemetry,
      rootSpan,
      rootContext,
      stepSpan: undefined,
      stepContext: undefined,
      embedSpans: new Map(),
      rerankSpan: undefined,
      toolSpans: new Map(),
      baseTelemetryAttributes,
      settings,
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

    const attributes = selectAttributes(telemetry, {
      ...assembleOperationName({
        operationId: event.operationId,
        telemetry,
      }),
      ...state.baseTelemetryAttributes,
      'ai.documents': {
        input: () => event.documents.map(d => JSON.stringify(d)),
      },
    });

    const rerankSpan = this.tracer.startSpan(
      event.operationId,
      { attributes },
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
      selectAttributes(telemetry, {
        'ai.ranking.type': event.documentsType,
        'ai.ranking': {
          output: () => event.ranking.map(r => JSON.stringify(r)),
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

    if (state.stepSpan) {
      recordSpanError(state.stepSpan, actualError);
      state.stepSpan.end();
    }

    for (const { span: embedSpan } of state.embedSpans.values()) {
      recordSpanError(embedSpan, actualError);
      embedSpan.end();
    }
    state.embedSpans.clear();

    if (state.rerankSpan) {
      recordSpanError(state.rerankSpan.span, actualError);
      state.rerankSpan.span.end();
      state.rerankSpan = undefined;
    }

    recordSpanError(state.rootSpan, actualError);

    state.rootSpan.end();
    this.cleanupCallState(event.callId);
  }
}
