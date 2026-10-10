import type {
  EmbeddingModelV4,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { tool } from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import * as assert from 'node:assert';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  context,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type SpanOptions,
  type Tracer,
} from '@opentelemetry/api';
import { z } from 'zod/v4';
import {
  embed,
  embedMany,
  generateObject,
  generateText,
  isStepCount,
  streamObject,
  streamText,
  rerank,
  type Embedding,
  type EmbeddingModelUsage,
  type GenerateTextEndEvent,
  type Telemetry,
} from 'ai';
import {
  MockEmbeddingModelV4,
  MockLanguageModelV4,
  MockRerankingModelV4,
  mockValues,
} from 'ai/test';
import { MockTracer as IntegrationMockTracer } from './mock-tracer';
import { LegacyOpenTelemetry } from './legacy-open-telemetry';

export function createResolvablePromise<T = any>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

type MockSpan = Span & {
  name: string;
  attributes: Attributes;
  events: Array<{ name: string; attributes?: Attributes }>;
  ended: boolean;
  status: { code: number; message?: string } | undefined;
  exceptions: unknown[];
};

function createMockSpan(name?: string): MockSpan {
  const span: MockSpan = {
    name: name ?? '',
    attributes: {},
    events: [],
    ended: false,
    status: undefined,
    exceptions: [],
    spanContext: () => ({
      traceId: 'trace-1',
      spanId: 'span-1',
      traceFlags: 1,
    }),
    setAttribute: vi.fn((key: string, value) => {
      span.attributes[key] = value;
      return span;
    }),
    setAttributes: vi.fn((attrs: Attributes) => {
      Object.assign(span.attributes, attrs);
      return span;
    }),
    addEvent: vi.fn((eventName: string, attrs?: Attributes) => {
      span.events.push({ name: eventName, attributes: attrs });
      return span;
    }),
    addLink: vi.fn(() => span),
    addLinks: vi.fn(() => span),
    setStatus: vi.fn(status => {
      span.status = status;
      return span;
    }),
    updateName: vi.fn(() => span),
    end: vi.fn(() => {
      span.ended = true;
    }),
    isRecording: vi.fn(() => true),
    recordException: vi.fn(exception => {
      span.exceptions.push(exception);
    }),
  };
  return span;
}

interface MockTracer extends Tracer {
  spans: MockSpan[];
}

function createMockTracer(): MockTracer {
  const tracer: MockTracer = {
    spans: [],
    startSpan: vi.fn((name: string, _options?, _context?) => {
      const span = createMockSpan(name);
      tracer.spans.push(span);
      return span;
    }),
    startActiveSpan: vi.fn() as Tracer['startActiveSpan'],
  };
  return tracer;
}

function getStartSpanAttributes(
  tracer: MockTracer,
  callIndex: number,
): Attributes {
  const mock = tracer.startSpan as ReturnType<typeof vi.fn>;
  return (
    (mock.mock.calls[callIndex][1] as SpanOptions | undefined)?.attributes ?? {}
  );
}

function getSetAttributesArg(span: MockSpan, callIndex = 0): Attributes {
  return (span.setAttributes as ReturnType<typeof vi.fn>).mock.calls[
    callIndex
  ][0] as Attributes;
}

let callId: string;
let callIdCounter = 0;

function telemetryFields() {
  return {
    recordInputs: undefined,
    recordOutputs: undefined,
    functionId: undefined,
  };
}

const model = { provider: 'test-provider', modelId: 'test-model' };

function makeOnStartEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    operationId: 'ai.generateText',
    provider: model.provider,
    modelId: model.modelId,
    instructions: undefined,
    messages: [{ role: 'user', content: 'Hello' }],
    tools: undefined,
    toolChoice: undefined,
    activeTools: undefined,
    toolOrder: undefined,
    maxOutputTokens: 100,
    temperature: 0.7,
    topP: undefined,
    topK: undefined,
    presencePenalty: undefined,
    frequencyPenalty: undefined,
    stopSequences: undefined,
    seed: undefined,
    maxRetries: 2,
    timeout: undefined,
    headers: undefined,
    providerOptions: undefined,
    stopWhen: undefined,
    output: undefined,
    abortSignal: undefined,
    include: undefined,
    ...telemetryFields(),
    runtimeContext: {},
    toolsContext: {},
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onStart']>>[0];
}

function makeStepStartEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    provider: model.provider,
    modelId: model.modelId,
    stepNumber: 0,
    instructions: undefined,
    messages: [],
    tools: undefined,
    toolChoice: undefined,
    activeTools: undefined,
    toolOrder: undefined,
    steps: [],
    providerOptions: undefined,
    abortSignal: undefined,
    output: undefined,
    include: undefined,
    ...telemetryFields(),
    runtimeContext: {},
    promptMessages: undefined,
    stepTools: undefined,
    stepToolChoice: undefined,
    toolsContext: {},
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onStepStart']>>[0];
}

function makeStepFinishEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    stepNumber: 0,
    model,
    ...telemetryFields(),
    runtimeContext: {},
    content: [{ type: 'text' as const, text: 'Hello world' }],
    text: 'Hello world',
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    toolCalls: [],
    staticToolCalls: [],
    dynamicToolCalls: [],
    toolResults: [],
    staticToolResults: [],
    dynamicToolResults: [],
    finishReason: 'stop' as const,
    rawFinishReason: 'stop',
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
    },
    performance: {
      effectiveOutputTokensPerSecond: 20,
      outputTokensPerSecond: undefined,
      inputTokensPerSecond: undefined,
      effectiveTotalTokensPerSecond: 30,
      stepTimeMs: 1000,
      responseTimeMs: 1000,
      toolExecutionMs: {},
      timeToFirstOutputMs: undefined,
    },
    warnings: undefined,
    request: { body: undefined, messages: [] },
    response: {
      id: 'resp-1',
      modelId: 'test-model',
      timestamp: new Date('2025-01-01T00:00:00Z'),
      messages: [],
    },
    providerMetadata: undefined,
    toolsContext: {},
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onStepFinish']>>[0];
}

function makeFinishEvent(overrides?: Record<string, unknown>) {
  const { usage, ...restOverrides } = overrides ?? {};
  const stepOverrides = Object.fromEntries(
    Object.entries(restOverrides).filter(([key]) =>
      [
        'providerMetadata',
        'reasoning',
        'reasoningText',
        'request',
        'response',
      ].includes(key),
    ),
  );
  const finalStep = makeStepFinishEvent(stepOverrides);
  const totalUsage = (usage as GenerateTextEndEvent['usage']) ?? {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: {
      textTokens: undefined,
      reasoningTokens: undefined,
    },
  };

  return {
    ...finalStep,
    responseMessages: [],
    steps: [finalStep],
    finalStep,
    usage: totalUsage,
    totalUsage,
    ...restOverrides,
  } as Parameters<NonNullable<Telemetry['onEnd']>>[0];
}

function makeToolCallStartEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    toolCall: {
      type: 'tool-call' as const,
      toolCallId: 'tool-call-1',
      toolName: 'myTool',
      input: { query: 'test' },
    },
    abortSignal: undefined,
    ...telemetryFields(),
    messages: [],
    toolContext: {},
    toolsContext: {},
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onToolExecutionStart']>>[0];
}

function makeToolCallFinishEvent(
  success: boolean,
  overrides?: Record<string, unknown>,
) {
  const base = {
    callId,
    toolCall: {
      type: 'tool-call' as const,
      toolCallId: 'tool-call-1',
      toolName: 'myTool',
      input: { query: 'test' },
    },
    abortSignal: undefined,
    toolExecutionMs: 42,
    ...telemetryFields(),
    messages: [],
    toolContext: {},
    toolsContext: {},
    ...overrides,
  };

  if (success) {
    return {
      ...base,
      toolOutput: {
        type: 'tool-result' as const,
        toolCallId: 'tool-call-1',
        toolName: 'myTool',
        input: { query: 'test' },
        output: { result: 'ok' },
        dynamic: false,
      },
    } as Parameters<NonNullable<Telemetry['onToolExecutionEnd']>>[0];
  }
  return {
    ...base,
    toolOutput: {
      type: 'tool-error' as const,
      toolCallId: 'tool-call-1',
      toolName: 'myTool',
      input: { query: 'test' },
      error: new Error('tool failed'),
      dynamic: false,
    },
  } as Parameters<NonNullable<Telemetry['onToolExecutionEnd']>>[0];
}

describe('LegacyOpenTelemetry', () => {
  let tracer: MockTracer;
  let otelIntegration: Telemetry;

  beforeEach(() => {
    tracer = createMockTracer();
    callId = `test-call-${++callIdCounter}`;
    otelIntegration = new LegacyOpenTelemetry({ tracer });
  });

  describe('onStart', () => {
    it('creates a root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      expect(tracer.startSpan).toHaveBeenCalledTimes(1);
      expect(tracer.spans).toHaveLength(1);
      expect(tracer.spans[0].name).toBe('ai.generateText');
    });

    it('sets model attributes on the root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.model.provider']).toBe('test-provider');
      expect(attrs['ai.model.id']).toBe('test-model');
    });

    it('sets prompt as input attribute', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.prompt']).toContain('Hello');
    });

    it('sets operation name attributes', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.operationId']).toBe('ai.generateText');
      expect(attrs['operation.name']).toBe('ai.generateText');
    });

    it('uses a tracer configured for the call id', () => {
      const configuredTracer = createMockTracer();
      const configuredIntegration = new LegacyOpenTelemetry({
        tracer: configuredTracer,
      });

      configuredIntegration.onStart!(makeOnStartEvent());

      expect(configuredTracer.startSpan).toHaveBeenCalledTimes(1);
    });
  });

  describe('onStepStart', () => {
    it('creates a step span as child of root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());

      expect(tracer.startSpan).toHaveBeenCalledTimes(2);
      expect(tracer.spans).toHaveLength(2);
      expect(tracer.spans[1].name).toBe('ai.generateText.doGenerate');
    });

    it('uses ai.streamText.doStream for streamText operations', () => {
      otelIntegration.onStart!(
        makeOnStartEvent({ operationId: 'ai.streamText' }),
      );
      otelIntegration.onStepStart!(makeStepStartEvent());

      expect(tracer.spans[1].name).toBe('ai.streamText.doStream');
    });

    it('sets gen_ai attributes on step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());

      const attrs = getStartSpanAttributes(tracer, 1);
      expect(attrs['gen_ai.system']).toBe('test-provider');
      expect(attrs['gen_ai.request.model']).toBe('test-model');
    });

    it('does not create step span without prior onStart', () => {
      otelIntegration.onStepStart!(makeStepStartEvent());

      expect(tracer.startSpan).not.toHaveBeenCalled();
    });

    it('does not create step span for unknown callId', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(
        makeStepStartEvent({ callId: 'unknown-id' }),
      );

      expect(tracer.spans).toHaveLength(1);
    });

    it('includes prompt messages when provided', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(
        makeStepStartEvent({
          promptMessages: [
            { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
          ],
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 1);
      expect(attrs['ai.prompt.messages']).toBeDefined();
    });

    it('includes tool choice and tools when provided', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(
        makeStepStartEvent({
          stepTools: [{ type: 'function', name: 'myTool' }],
          stepToolChoice: { type: 'auto' },
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 1);
      expect(attrs['ai.prompt.tools']).toBeDefined();
      expect(attrs['ai.prompt.toolChoice']).toBeDefined();
    });
  });

  describe('executeLanguageModelCall', () => {
    it('runs the model call inside the active step span context', async () => {
      let activeSpan: Span | undefined;
      const contextWithSpy = vi
        .spyOn(context, 'with')
        .mockImplementation((nextContext, fn, thisArg, ...args) => {
          activeSpan = trace.getSpan(nextContext) ?? undefined;
          return fn.call(thisArg, ...args);
        });

      try {
        otelIntegration.onStart!(makeOnStartEvent());
        otelIntegration.onStepStart!(makeStepStartEvent());

        await expect(
          otelIntegration.executeLanguageModelCall!({
            callId,
            execute: async () => 'result',
          }),
        ).resolves.toBe('result');

        const activeSpanRecord = tracer.spans.find(span => span === activeSpan);
        expect(activeSpanRecord?.name).toBe('ai.generateText.doGenerate');
      } finally {
        contextWithSpy.mockRestore();
      }
    });
  });

  describe('onToolExecutionStart', () => {
    it('creates a tool span as child of step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      expect(tracer.startSpan).toHaveBeenCalledTimes(3);
      expect(tracer.spans).toHaveLength(3);
      expect(tracer.spans[2].name).toBe('ai.toolCall');
    });

    it('sets tool call attributes', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      const attrs = getStartSpanAttributes(tracer, 2);
      expect(attrs['ai.toolCall.name']).toBe('myTool');
      expect(attrs['ai.toolCall.id']).toBe('tool-call-1');
    });

    it('sets tool call args as output attribute', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      const attrs = getStartSpanAttributes(tracer, 2);
      expect(attrs['ai.toolCall.args']).toBe(JSON.stringify({ query: 'test' }));
    });

    it('does not create tool span without prior step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      expect(tracer.spans).toHaveLength(1);
    });

    it('creates multiple tool spans for concurrent tool calls', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());

      otelIntegration.onToolExecutionStart!(
        makeToolCallStartEvent({
          toolCall: {
            toolCallId: 'tool-1',
            toolName: 'toolA',
            input: {},
          },
        }),
      );
      otelIntegration.onToolExecutionStart!(
        makeToolCallStartEvent({
          toolCall: {
            toolCallId: 'tool-2',
            toolName: 'toolB',
            input: {},
          },
        }),
      );

      expect(tracer.spans).toHaveLength(4);
      expect(tracer.spans[2].name).toBe('ai.toolCall');
      expect(tracer.spans[3].name).toBe('ai.toolCall');
    });
  });

  describe('onToolExecutionEnd', () => {
    it('ends the tool span on success', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      const toolSpan = tracer.spans[2];
      expect(toolSpan.ended).toBe(true);
    });

    it('sets result attribute on successful tool call', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      const toolSpan = tracer.spans[2];
      expect(toolSpan.setAttributes).toHaveBeenCalled();
    });

    it('records error on failed tool call', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(false));

      const toolSpan = tracer.spans[2];
      expect(toolSpan.ended).toBe(true);
      expect(toolSpan.recordException).toHaveBeenCalled();
      expect(toolSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
    });

    it('does nothing for unknown tool call id', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      otelIntegration.onToolExecutionEnd!(
        makeToolCallFinishEvent(true, {
          toolCall: {
            toolCallId: 'unknown-tool',
            toolName: 'myTool',
            input: {},
          },
        }),
      );

      const toolSpan = tracer.spans[2];
      expect(toolSpan.ended).toBe(false);
    });

    it('removes tool span from state after finishing', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      expect(tracer.spans[2].end).toHaveBeenCalledTimes(1);
    });
  });

  describe('onStepFinish', () => {
    it('ends the step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());

      const stepSpan = tracer.spans[1];
      expect(stepSpan.ended).toBe(true);
    });

    it('sets response attributes on step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());

      const stepSpan = tracer.spans[1];
      expect(stepSpan.setAttributes).toHaveBeenCalled();

      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.finishReason']).toBe('stop');
      expect(setAttrsCall['ai.usage.inputTokens']).toBe(10);
      expect(setAttrsCall['ai.usage.outputTokens']).toBe(20);
      expect(setAttrsCall['ai.response.id']).toBe('resp-1');
      expect(setAttrsCall['ai.response.model']).toBe('test-model');
    });

    it('sets gen_ai response attributes', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['gen_ai.response.finish_reasons']).toEqual(['stop']);
      expect(setAttrsCall['gen_ai.response.id']).toBe('resp-1');
      expect(setAttrsCall['gen_ai.response.model']).toBe('test-model');
      expect(setAttrsCall['gen_ai.usage.input_tokens']).toBe(10);
      expect(setAttrsCall['gen_ai.usage.output_tokens']).toBe(20);
    });

    it('omits malformed gen_ai finish reason arrays', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({ finishReason: undefined }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect('gen_ai.response.finish_reasons' in setAttrsCall).toBe(false);
    });

    it('includes text in output attributes', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({ text: 'Generated text' }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.text']).toBe('Generated text');
    });

    it('includes reasoning when present', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({
          reasoning: [
            { type: 'reasoning', text: 'Step 1' },
            { type: 'reasoning', text: 'Step 2' },
          ],
        }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.reasoning']).toBe('Step 1\nStep 2');
    });

    it('includes tool calls when present', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({
          toolCalls: [
            {
              toolCallId: 'tc-1',
              toolName: 'myTool',
              input: { q: 'test' },
            },
          ],
        }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.toolCalls']).toBeDefined();
      const parsed = JSON.parse(
        setAttrsCall['ai.response.toolCalls'] as string,
      );
      expect(parsed[0].toolName).toBe('myTool');
    });

    it('includes files when present', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({
          files: [
            {
              mediaType: 'image/png',
              base64: 'iVBORw0KGgo=',
            },
          ],
        }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.files']).toBeDefined();
      const parsed = JSON.parse(setAttrsCall['ai.response.files'] as string);
      expect(parsed).toEqual([
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      ]);
    });

    it('does not include files when empty', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent({ files: [] }));

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.files']).toBeUndefined();
    });

    it('does nothing without prior step span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());

      expect(tracer.spans).toHaveLength(1);
    });

    it('allows a new step span after finishing a step', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent({ stepNumber: 0 }));

      otelIntegration.onStepStart!(makeStepStartEvent({ steps: [{}] }));
      otelIntegration.onStepFinish!(makeStepFinishEvent({ stepNumber: 1 }));

      expect(tracer.spans).toHaveLength(3);
      expect(tracer.spans[1].ended).toBe(true);
      expect(tracer.spans[2].ended).toBe(true);
    });
  });

  describe('onEnd', () => {
    it('ends the root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(makeFinishEvent());

      const rootSpan = tracer.spans[0];
      expect(rootSpan.ended).toBe(true);
    });

    it('sets aggregated usage attributes on root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(
        makeFinishEvent({
          usage: {
            inputTokens: 50,
            outputTokens: 100,
            totalTokens: 150,
          },
        }),
      );

      const rootSpan = tracer.spans[0];
      const setAttrsCall = getSetAttributesArg(rootSpan);
      expect(setAttrsCall['ai.usage.inputTokens']).toBe(50);
      expect(setAttrsCall['ai.usage.outputTokens']).toBe(100);
      expect(setAttrsCall['ai.usage.totalTokens']).toBe(150);
    });

    it('sets finish reason on root span', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(makeFinishEvent());

      const rootSpan = tracer.spans[0];
      const setAttrsCall = getSetAttributesArg(rootSpan);
      expect(setAttrsCall['ai.response.finishReason']).toBe('stop');
    });

    it('includes files in root span when present', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(
        makeFinishEvent({
          files: [
            {
              mediaType: 'image/png',
              base64: 'iVBORw0KGgo=',
            },
          ],
        }),
      );

      const rootSpan = tracer.spans[0];
      const setAttrsCall = getSetAttributesArg(rootSpan);
      expect(setAttrsCall['ai.response.files']).toBeDefined();
      const parsed = JSON.parse(setAttrsCall['ai.response.files'] as string);
      expect(parsed).toEqual([
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      ]);
    });

    it('cleans up call state after finishing', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(makeFinishEvent());

      otelIntegration.onStepStart!(makeStepStartEvent());
      expect(tracer.spans).toHaveLength(2);
    });

    it('does nothing without prior onStart', () => {
      otelIntegration.onEnd!(makeFinishEvent());

      expect(tracer.spans).toHaveLength(0);
    });
  });

  describe('onError', () => {
    it('records error on root span and ends it', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());

      const error = new Error('something went wrong');
      otelIntegration.onError!({ callId, error });

      const rootSpan = tracer.spans[0];
      expect(rootSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Error',
          message: 'something went wrong',
        }),
      );
      expect(rootSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          code: SpanStatusCode.ERROR,
          message: 'something went wrong',
        }),
      );
      expect(rootSpan.ended).toBe(true);
    });

    it('records error on step span and ends it when active', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());

      const error = new Error('step error');
      otelIntegration.onError!({ callId, error });

      const stepSpan = tracer.spans[1];
      expect(stepSpan.recordException).toHaveBeenCalled();
      expect(stepSpan.ended).toBe(true);
    });

    it('handles non-Error objects', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      otelIntegration.onError!({ callId, error: 'string error' });

      const rootSpan = tracer.spans[0];
      expect(rootSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
      expect(rootSpan.ended).toBe(true);
    });

    it('does nothing without callId', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      otelIntegration.onError!({ error: new Error('no callId') });

      const rootSpan = tracer.spans[0];
      expect(rootSpan.ended).toBe(false);
    });

    it('does nothing for unknown callId', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      otelIntegration.onError!({
        callId: 'unknown',
        error: new Error('unknown'),
      });

      const rootSpan = tracer.spans[0];
      expect(rootSpan.ended).toBe(false);
    });

    it('cleans up call state after error', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onError!({ callId, error: new Error('fail') });

      otelIntegration.onStepStart!(makeStepStartEvent());
      expect(tracer.spans).toHaveLength(1);
    });
  });

  describe('onAbort', () => {
    it('closes streamText spans when AbortController aborts the stream', async () => {
      const abortController = new AbortController();
      let pullCalls = 0;

      const result = streamText({
        abortSignal: abortController.signal,
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: new ReadableStream({
              pull(controller) {
                switch (pullCalls++) {
                  case 0:
                    controller.enqueue({
                      type: 'stream-start',
                      warnings: [],
                    });
                    break;
                  case 1:
                    controller.enqueue({
                      type: 'text-start',
                      id: '1',
                    });
                    break;
                  case 2:
                    controller.enqueue({
                      type: 'text-delta',
                      id: '1',
                      delta: 'Hello',
                    });
                    break;
                  case 3:
                    abortController.abort();
                    controller.error(
                      new DOMException(
                        'The user aborted a request.',
                        'AbortError',
                      ),
                    );
                    break;
                }
              },
            }),
          }),
        }),
        prompt: 'test-input',
        telemetry: {
          integrations: otelIntegration,
        },
      });

      await result.consumeStream();

      expect(
        tracer.spans.map(span => ({
          name: span.name,
          ended: span.ended,
          status: span.status,
        })),
      ).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "name": "ai.streamText",
            "status": undefined,
          },
          {
            "ended": true,
            "name": "ai.streamText.doStream",
            "status": undefined,
          },
        ]
      `);
    });
  });

  describe('telemetry disabled / recordInputs / recordOutputs', () => {
    it('does not record input attributes when recordInputs is false', () => {
      otelIntegration.onStart!(makeOnStartEvent({ recordInputs: false }));

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.prompt']).toBeUndefined();
    });

    it('does not record output attributes when recordOutputs is false', () => {
      otelIntegration.onStart!(makeOnStartEvent({ recordOutputs: false }));
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({ text: 'secret output' }),
      );

      const stepSpan = tracer.spans[1];
      const setAttrsCall = getSetAttributesArg(stepSpan);
      expect(setAttrsCall['ai.response.text']).toBeUndefined();
    });

    it('records non-input/output attributes even when recordInputs is false', () => {
      otelIntegration.onStart!(makeOnStartEvent({ recordInputs: false }));

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.model.provider']).toBe('test-provider');
      expect(attrs['ai.model.id']).toBe('test-model');
    });

    it('does not record tool call args when recordOutputs is false', () => {
      otelIntegration.onStart!(makeOnStartEvent({ recordOutputs: false }));
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());

      const attrs = getStartSpanAttributes(tracer, 2);
      expect(attrs['ai.toolCall.args']).toBeUndefined();
    });

    it('does not record tool call result when recordOutputs is false', () => {
      otelIntegration.onStart!(makeOnStartEvent({ recordOutputs: false }));
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      const toolSpan = tracer.spans[2];
      const setAttrsCalls = (toolSpan.setAttributes as ReturnType<typeof vi.fn>)
        .mock.calls;
      if (setAttrsCalls.length > 0) {
        expect(
          (setAttrsCalls[0][0] as Attributes)['ai.toolCall.result'],
        ).toBeUndefined();
      }
    });
  });

  describe('full lifecycle', () => {
    it('creates correct span hierarchy for generateText with tool call', () => {
      otelIntegration.onStart!(makeOnStartEvent());
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      otelIntegration.onStepFinish!(makeStepFinishEvent());
      otelIntegration.onEnd!(makeFinishEvent());

      expect(tracer.spans).toHaveLength(3);
      expect(tracer.spans[0].name).toBe('ai.generateText');
      expect(tracer.spans[1].name).toBe('ai.generateText.doGenerate');
      expect(tracer.spans[2].name).toBe('ai.toolCall');

      expect(tracer.spans[0].ended).toBe(true);
      expect(tracer.spans[1].ended).toBe(true);
      expect(tracer.spans[2].ended).toBe(true);
    });

    it('creates correct span hierarchy for multi-step generation', () => {
      otelIntegration.onStart!(makeOnStartEvent());

      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onToolExecutionStart!(makeToolCallStartEvent());
      otelIntegration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      otelIntegration.onStepFinish!(makeStepFinishEvent({ stepNumber: 0 }));

      otelIntegration.onStepStart!(makeStepStartEvent({ steps: [{}] }));
      otelIntegration.onStepFinish!(makeStepFinishEvent({ stepNumber: 1 }));

      otelIntegration.onEnd!(makeFinishEvent());

      expect(tracer.spans).toHaveLength(4);
      expect(tracer.spans[0].name).toBe('ai.generateText');
      expect(tracer.spans[1].name).toBe('ai.generateText.doGenerate');
      expect(tracer.spans[2].name).toBe('ai.toolCall');
      expect(tracer.spans[3].name).toBe('ai.generateText.doGenerate');

      for (const span of tracer.spans) {
        expect(span.ended).toBe(true);
      }
    });

    it('handles concurrent calls with different callIds', () => {
      const callId1 = 'call-1';
      const callId2 = 'call-2';

      otelIntegration.onStart!(makeOnStartEvent({ callId: callId1 }));
      otelIntegration.onStart!(makeOnStartEvent({ callId: callId2 }));

      expect(tracer.spans).toHaveLength(2);

      otelIntegration.onStepStart!(makeStepStartEvent({ callId: callId1 }));
      otelIntegration.onStepStart!(makeStepStartEvent({ callId: callId2 }));

      expect(tracer.spans).toHaveLength(4);

      otelIntegration.onStepFinish!(makeStepFinishEvent({ callId: callId1 }));
      otelIntegration.onEnd!(makeFinishEvent({ callId: callId1 }));

      expect(tracer.spans[0].ended).toBe(true);
      expect(tracer.spans[2].ended).toBe(true);

      expect(tracer.spans[1].ended).toBe(false);
      expect(tracer.spans[3].ended).toBe(false);

      otelIntegration.onStepFinish!(makeStepFinishEvent({ callId: callId2 }));
      otelIntegration.onEnd!(makeFinishEvent({ callId: callId2 }));

      for (const span of tracer.spans) {
        expect(span.ended).toBe(true);
      }
    });

    it('creates correct span hierarchy for streamText', () => {
      otelIntegration.onStart!(
        makeOnStartEvent({ operationId: 'ai.streamText' }),
      );
      otelIntegration.onStepStart!(makeStepStartEvent());
      otelIntegration.onStepFinish!(
        makeStepFinishEvent({
          performance: {
            effectiveOutputTokensPerSecond: 20,
            outputTokensPerSecond: 20.2020202020202,
            inputTokensPerSecond: 1000,
            effectiveTotalTokensPerSecond: 30,
            stepTimeMs: 1000,
            responseTimeMs: 1000,
            toolExecutionMs: {},
            timeToFirstOutputMs: 10,
          },
        }),
      );
      otelIntegration.onEnd!(makeFinishEvent());

      expect(tracer.spans).toHaveLength(2);
      expect(tracer.spans[0].name).toBe('ai.streamText');
      expect(tracer.spans[1].name).toBe('ai.streamText.doStream');

      const stepSpan = tracer.spans[1];
      expect(stepSpan.events).toHaveLength(2);
      expect(stepSpan.events[0].name).toBe('ai.stream.firstChunk');
      expect(stepSpan.events[1].name).toBe('ai.stream.finish');

      for (const span of tracer.spans) {
        expect(span.ended).toBe(true);
      }
    });
  });

  describe('functionId in telemetry', () => {
    it('includes functionId in operation name', () => {
      otelIntegration.onStart!(
        makeOnStartEvent({
          functionId: 'my-chat',
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['operation.name']).toBe('ai.generateText my-chat');
      expect(attrs['resource.name']).toBe('my-chat');
      expect(attrs['ai.telemetry.functionId']).toBe('my-chat');
    });
  });

  describe('context in telemetry', () => {
    it('includes context as telemetry attributes', () => {
      otelIntegration.onStart!(
        makeOnStartEvent({
          runtimeContext: { userId: 'user-123', sessionId: 'sess-456' },
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(attrs['ai.settings.context.userId']).toBe('user-123');
      expect(attrs['ai.settings.context.sessionId']).toBe('sess-456');
    });
  });
});

const integrationTestUsage: LanguageModelV4Usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: undefined,
  },
};

const integrationDummyResponseValues = {
  finishReason: { unified: 'stop', raw: 'stop' } as const,
  usage: integrationTestUsage,
  warnings: [],
};

const integrationModelWithReasoning = new MockLanguageModelV4({
  doGenerate: {
    ...integrationDummyResponseValues,
    content: [
      {
        type: 'reasoning',
        text: 'I will open the conversation with witty banter.',
        providerMetadata: {
          testProvider: {
            signature: 'signature',
          },
        },
      },
      {
        type: 'reasoning',
        text: '',
        providerMetadata: {
          testProvider: {
            redactedData: 'redacted-reasoning-data',
          },
        },
      },
      { type: 'text', text: 'Hello, world!' },
    ],
  },
});

describe('LegacyOpenTelemetry integration with generateText', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async ({}) => ({
          ...integrationDummyResponseValues,
          content: [{ type: 'text', text: 'Hello, world!' }],
          response: {
            id: 'test-id-default-enabled',
            timestamp: new Date(10000),
            modelId: 'mock-model-id',
          },
        }),
      }),
      prompt: 'prompt',
      experimental_telemetry: {
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled', async () => {
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async ({}) => ({
          ...integrationDummyResponseValues,
          content: [{ type: 'text', text: 'Hello, world!' }],
          response: {
            id: 'test-id-from-model',
            timestamp: new Date(10000),
            modelId: 'test-response-model-id',
          },
          providerMetadata: {
            testProvider: {
              testKey: 'testValue',
            },
          },
        }),
      }),
      prompt: 'prompt',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      runtimeContext: {
        test1: 'value1',
        test2: false,
      },
      stopSequences: ['stop'],
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        includeRuntimeContext: {
          test1: true,
          test2: true,
        },
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record successful tool call', async () => {
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async ({}) => ({
          ...integrationDummyResponseValues,
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
          ],
          response: {
            id: 'test-id',
            timestamp: new Date(0),
            modelId: 'mock-model-id',
          },
        }),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: {
        generateId: () => 'test-id',
        generateCallId: () => 'test-telemetry-call-id',
      },
    });

    expect(tracer.jsonSpans).toMatchInlineSnapshot(`
      [
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.generateText",
            "ai.prompt": "{"messages":[{"role":"user","content":"test-input"}]}",
            "ai.request.headers.user-agent": "ai/0.0.0-test",
            "ai.response.finishReason": "stop",
            "ai.response.text": "",
            "ai.response.toolCalls": "[{"toolCallId":"call-1","toolName":"tool1","input":{"value":"value"}}]",
            "ai.settings.maxRetries": 2,
            "ai.usage.inputTokenDetails.noCacheTokens": 3,
            "ai.usage.inputTokens": 3,
            "ai.usage.outputTokenDetails.textTokens": 10,
            "ai.usage.outputTokens": 10,
            "ai.usage.totalTokens": 13,
            "operation.name": "ai.generateText",
          },
          "events": [],
          "name": "ai.generateText",
        },
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.generateText.doGenerate",
            "ai.prompt.messages": "[{"role":"user","content":[{"type":"text","text":"test-input"}]}]",
            "ai.prompt.toolChoice": "{"type":"auto"}",
            "ai.prompt.tools": [
              "{"type":"function","name":"tool1","inputSchema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"value":{"type":"string"}},"required":["value"],"additionalProperties":false}}",
            ],
            "ai.request.headers.user-agent": "ai/0.0.0-test",
            "ai.response.finishReason": "stop",
            "ai.response.id": "test-id",
            "ai.response.model": "mock-model-id",
            "ai.response.text": "",
            "ai.response.timestamp": "1970-01-01T00:00:00.000Z",
            "ai.response.toolCalls": "[{"toolCallId":"call-1","toolName":"tool1","input":{"value":"value"}}]",
            "ai.settings.maxRetries": 2,
            "ai.usage.inputTokenDetails.noCacheTokens": 3,
            "ai.usage.inputTokens": 3,
            "ai.usage.outputTokenDetails.textTokens": 10,
            "ai.usage.outputTokens": 10,
            "ai.usage.totalTokens": 13,
            "gen_ai.request.model": "mock-model-id",
            "gen_ai.response.finish_reasons": [
              "stop",
            ],
            "gen_ai.response.id": "test-id",
            "gen_ai.response.model": "mock-model-id",
            "gen_ai.system": "mock-provider",
            "gen_ai.usage.input_tokens": 3,
            "gen_ai.usage.output_tokens": 10,
            "operation.name": "ai.generateText.doGenerate",
          },
          "events": [],
          "name": "ai.generateText.doGenerate",
        },
        {
          "attributes": {
            "ai.operationId": "ai.toolCall",
            "ai.toolCall.args": "{"value":"value"}",
            "ai.toolCall.id": "call-1",
            "ai.toolCall.name": "tool1",
            "ai.toolCall.result": ""result1"",
            "operation.name": "ai.toolCall",
          },
          "events": [],
          "name": "ai.toolCall",
        },
      ]
    `);
  });

  it('should record error on tool call', async () => {
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async ({}) => ({
          ...integrationDummyResponseValues,
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
          ],
        }),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => {
            throw new Error('Tool execution failed');
          },
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: {
        generateId: () => 'test-id',
        generateCallId: () => 'test-telemetry-call-id',
      },
    });

    expect(tracer.jsonSpans).toHaveLength(3);

    expect(tracer.jsonSpans[0].name).toBe('ai.generateText');
    expect(tracer.jsonSpans[1].name).toBe('ai.generateText.doGenerate');
    expect(tracer.jsonSpans[2].name).toBe('ai.toolCall');

    const toolCallSpan = tracer.jsonSpans[2];
    expect(toolCallSpan.status).toEqual({
      code: 2,
      message: 'Tool execution failed',
    });

    expect(toolCallSpan.events).toHaveLength(1);
    const exceptionEvent = toolCallSpan.events[0];
    expect(exceptionEvent.name).toBe('exception');
    expect(exceptionEvent.attributes).toMatchObject({
      'exception.message': 'Tool execution failed',
      'exception.name': 'Error',
    });
    expect(exceptionEvent.attributes?.['exception.stack']).toContain(
      'Tool execution failed',
    );
    expect(exceptionEvent.time).toEqual([0, 0]);
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async ({}) => ({
          ...integrationDummyResponseValues,
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
          ],
          response: {
            id: 'test-id',
            timestamp: new Date(0),
            modelId: 'mock-model-id',
          },
        }),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: {
        generateId: () => 'test-id',
        generateCallId: () => 'test-telemetry-call-id',
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record reasoning in telemetry when present', async () => {
    await generateText({
      model: integrationModelWithReasoning,
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    const rootSpan = tracer.jsonSpans.find(
      span => span.name === 'ai.generateText',
    );
    const doGenerateSpan = tracer.jsonSpans.find(
      span => span.name === 'ai.generateText.doGenerate',
    );

    expect(rootSpan?.attributes['ai.response.reasoning']).toBe(
      'I will open the conversation with witty banter.\n',
    );
    expect(doGenerateSpan?.attributes['ai.response.reasoning']).toBe(
      'I will open the conversation with witty banter.\n',
    );
  });

  it('should record total usage across steps in root span', async () => {
    let responseCount = 0;
    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async () => {
          switch (responseCount++) {
            case 0:
              return {
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
                usage: {
                  inputTokens: {
                    total: 5,
                    noCache: 5,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 20,
                    text: 20,
                    reasoning: undefined,
                  },
                },
                warnings: [],
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: '{ "value": "value" }',
                  },
                ],
              };
            case 1:
            default:
              return {
                finishReason: {
                  unified: 'stop' as const,
                  raw: 'stop',
                },
                usage: {
                  inputTokens: {
                    total: 10,
                    noCache: 10,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 15,
                    text: 15,
                    reasoning: undefined,
                  },
                },
                warnings: [],
                content: [{ type: 'text' as const, text: 'Final answer.' }],
              };
          }
        },
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        },
      },
      stopWhen: isStepCount(2),
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    const rootSpan = tracer.jsonSpans.find(
      span => span.name === 'ai.generateText',
    );

    expect(rootSpan?.attributes['ai.usage.inputTokens']).toBe(15);
    expect(rootSpan?.attributes['ai.usage.outputTokens']).toBe(35);
    expect(rootSpan?.attributes['ai.usage.totalTokens']).toBe(50);
  });

  it('should execute subagent generateText inside executeToolCall context', async () => {
    let activeContext: string | undefined;
    let capturedContext: string | undefined;
    const otelIntegration = new LegacyOpenTelemetry({ tracer });

    await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          ...integrationDummyResponseValues,
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'researchTool',
              input: '{ "city": "Tokyo" }',
            },
          ],
        }),
      }),
      tools: {
        researchTool: tool({
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            capturedContext = activeContext;

            const subResult = await generateText({
              model: new MockLanguageModelV4({
                doGenerate: async () => ({
                  ...integrationDummyResponseValues,
                  content: [
                    { type: 'text', text: `Weather in ${city}: sunny` },
                  ],
                }),
              }),
              prompt: `Weather for ${city}`,
              experimental_telemetry: {
                isEnabled: true,
                functionId: `sub-agent-${city.toLowerCase()}`,
                integrations: otelIntegration,
              },
            });
            return subResult.text;
          },
        }),
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'weather-agent',
        integrations: [
          otelIntegration,
          {
            executeTool: async ({ callId, toolCallId, execute }) => {
              activeContext = `${callId}:${toolCallId}`;
              try {
                return await execute();
              } finally {
                activeContext = undefined;
              }
            },
          },
        ],
      },
      _internal: {
        generateId: () => 'outer-test-id',
        generateCallId: () => 'outer-test-call-id',
      },
    });

    expect(capturedContext).toBe('outer-test-call-id:call-1');

    expect(tracer.spans.map(s => s.name)).toEqual([
      'ai.generateText',
      'ai.generateText.doGenerate',
      'ai.toolCall',
      'ai.generateText',
      'ai.generateText.doGenerate',
    ]);

    const toolCallSpan = tracer.spans[2];
    expect(toolCallSpan.attributes['ai.toolCall.name']).toBe('researchTool');

    const innerRootSpan = tracer.spans[3];
    expect(innerRootSpan.attributes['ai.telemetry.functionId']).toBe(
      'sub-agent-tokyo',
    );

    const innerStepSpan = tracer.spans[4];
    expect(innerStepSpan.attributes['ai.response.text']).toBe(
      'Weather in Tokyo: sunny',
    );
  });
});

function createStreamTestModel({
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start' as const,
      warnings: [],
    },
    {
      type: 'response-metadata' as const,
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-start' as const, id: '1' },
    { type: 'text-delta' as const, id: '1', delta: 'Hello' },
    { type: 'text-delta' as const, id: '1', delta: ', ' },
    { type: 'text-delta' as const, id: '1', delta: 'world!' },
    { type: 'text-end' as const, id: '1' },
    {
      type: 'finish' as const,
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: integrationTestUsage,
      providerMetadata: {
        testProvider: { testKey: 'testValue' },
      },
    },
  ]),
}: {
  stream?: ReadableStream<LanguageModelV4StreamPart>;
} = {}) {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream }),
  });
}

function mockTokenStreamTextTelemetryNow() {
  return mockValues(0, 0, 100, 500, 500);
}

function mockToolOnlyStreamTextTelemetryNow() {
  return mockValues(0, 0, 500, 500);
}

function mockTwoStepStreamTextTelemetryNow() {
  return mockValues(
    0,
    0,
    100,
    500,
    500,
    600,
    600,
    1000,
    1000,
    1000,
    1400,
    1400,
    1400,
  );
}

describe('LegacyOpenTelemetry integration with streamText', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    const result = streamText({
      model: createStreamTestModel(),
      prompt: 'test-input',
      experimental_telemetry: {
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: {
        now: mockTokenStreamTextTelemetryNow(),
      },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled', async () => {
    const result = streamText({
      model: createStreamTestModel(),
      prompt: 'test-input',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      stopSequences: ['stop'],
      runtimeContext: {
        test1: 'value1',
        test2: false,
      },
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        includeRuntimeContext: {
          test1: true,
          test2: true,
        },
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockTokenStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record successful tool call', async () => {
    const result = streamText({
      model: createStreamTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'tool1',
            input: `{ "value": "value" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: integrationTestUsage,
          },
        ]),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockToolOnlyStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record error on tool call', async () => {
    const result = streamText({
      model: createStreamTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'tool1',
            input: `{ "value": "value" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: integrationTestUsage,
          },
        ]),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => {
            throw new Error('Tool execution failed');
          },
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockToolOnlyStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toHaveLength(3);

    expect(tracer.jsonSpans[0].name).toBe('ai.streamText');
    expect(tracer.jsonSpans[1].name).toBe('ai.streamText.doStream');
    expect(tracer.jsonSpans[2].name).toBe('ai.toolCall');

    const toolCallSpan = tracer.jsonSpans[2];
    expect(toolCallSpan.status).toEqual({
      code: 2,
      message: 'Tool execution failed',
    });

    expect(toolCallSpan.events).toHaveLength(1);
    const exceptionEvent = toolCallSpan.events[0];
    expect(exceptionEvent.name).toBe('exception');
    expect(exceptionEvent.attributes).toMatchObject({
      'exception.message': 'Tool execution failed',
      'exception.name': 'Error',
    });
    expect(exceptionEvent.attributes?.['exception.stack']).toContain(
      'Tool execution failed',
    );
    expect(exceptionEvent.time).toEqual([0, 0]);
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    const result = streamText({
      model: createStreamTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'tool1',
            input: `{ "value": "value" }`,
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: integrationTestUsage,
          },
        ]),
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockToolOnlyStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record reasoning in telemetry when present', async () => {
    const result = streamText({
      model: createStreamTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'reasoning-start', id: '1' },
          {
            type: 'reasoning-delta',
            id: '1',
            delta: 'This is my reasoning ',
          },
          {
            type: 'reasoning-delta',
            id: '1',
            delta: 'about the problem.',
          },
          { type: 'reasoning-end', id: '1' },
          { type: 'text-start', id: '2' },
          { type: 'text-delta', id: '2', delta: 'Hello, world!' },
          { type: 'text-end', id: '2' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: integrationTestUsage,
          },
        ]),
      }),
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockTokenStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    const rootSpan = tracer.jsonSpans.find(
      span => span.name === 'ai.streamText',
    );
    const doStreamSpan = tracer.jsonSpans.find(
      span => span.name === 'ai.streamText.doStream',
    );

    expect(rootSpan?.attributes['ai.response.reasoning']).toBe(
      'This is my reasoning about the problem.',
    );
    expect(doStreamSpan?.attributes['ai.response.reasoning']).toBe(
      'This is my reasoning about the problem.',
    );
  });

  it('should execute subagent streamText inside executeToolCall context', async () => {
    let activeContext: string | undefined;
    let capturedContext: string | undefined;
    const otelIntegration = new LegacyOpenTelemetry({ tracer });

    const result = streamText({
      model: createStreamTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'researchTool',
            input: '{ "city": "Tokyo" }',
          },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: integrationTestUsage,
          },
        ]),
      }),
      tools: {
        researchTool: tool({
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            capturedContext = activeContext;

            const innerResult = streamText({
              model: createStreamTestModel({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'inner-id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: `Weather in ${city}: sunny`,
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: integrationTestUsage,
                  },
                ]),
              }),
              prompt: `Weather for ${city}`,
              experimental_telemetry: {
                isEnabled: true,
                functionId: `sub-agent-${city.toLowerCase()}`,
                integrations: otelIntegration,
              },
              _internal: { now: mockTokenStreamTextTelemetryNow() },
              onError: () => {},
            });

            return await innerResult.text;
          },
        }),
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'weather-agent',
        integrations: [
          otelIntegration,
          {
            executeTool: async ({ callId, toolCallId, execute }) => {
              activeContext = `${callId}:${toolCallId}`;
              try {
                return await execute();
              } finally {
                activeContext = undefined;
              }
            },
          },
        ],
      },
      _internal: {
        now: mockToolOnlyStreamTextTelemetryNow(),
        generateId: mockId({ prefix: 'id' }),
        generateCallId: () => 'outer-test-call-id',
      },
      onError: () => {},
    });

    await result.consumeStream();

    expect(capturedContext).toBe('outer-test-call-id:call-1');

    expect(tracer.spans.map(s => s.name)).toEqual([
      'ai.streamText',
      'ai.streamText.doStream',
      'ai.toolCall',
      'ai.streamText',
      'ai.streamText.doStream',
    ]);

    const toolCallSpan = tracer.spans[2];
    expect(toolCallSpan.attributes['ai.toolCall.name']).toBe('researchTool');

    const innerRootSpan = tracer.spans[3];
    expect(innerRootSpan.attributes['ai.telemetry.functionId']).toBe(
      'sub-agent-tokyo',
    );

    const innerStepSpan = tracer.spans[4];
    expect(innerStepSpan.attributes['ai.response.text']).toBe(
      'Weather in Tokyo: sunny',
    );
  });
});

const rerankModel = new MockRerankingModelV4({
  doRerank: async () => ({
    ranking: [
      { index: 2, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.8 },
      { index: 1, relevanceScore: 0.7 },
    ],
    providerMetadata: {
      aProvider: {
        someResponseKey: 'someResponseValue',
      },
    },
    response: {
      headers: {
        'content-type': 'application/json',
      },
      body: {
        id: '123',
      },
    },
  }),
});

describe('LegacyOpenTelemetry integration with rerank', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    await rerank({
      model: rerankModel,
      documents: [
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ],
      experimental_telemetry: {
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      query: 'rainy day',
      topN: 3,
    });

    expect(tracer.jsonSpans).toMatchInlineSnapshot(`
      [
        {
          "attributes": {
            "ai.documents": [
              ""sunny day at the beach"",
              ""rainy day in the city"",
              ""cloudy day in the mountains"",
            ],
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank",
            "ai.settings.maxRetries": 2,
            "operation.name": "ai.rerank",
          },
          "events": [],
          "name": "ai.rerank",
        },
        {
          "attributes": {
            "ai.documents": [
              ""sunny day at the beach"",
              ""rainy day in the city"",
              ""cloudy day in the mountains"",
            ],
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank.doRerank",
            "ai.ranking": [
              "{"index":2,"relevanceScore":0.9}",
              "{"index":0,"relevanceScore":0.8}",
              "{"index":1,"relevanceScore":0.7}",
            ],
            "ai.ranking.type": "text",
            "ai.settings.maxRetries": 2,
            "operation.name": "ai.rerank.doRerank",
          },
          "events": [],
          "name": "ai.rerank.doRerank",
        },
      ]
    `);
  });

  it('should record telemetry data when enabled (single call path)', async () => {
    await rerank({
      model: rerankModel,
      documents: [
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ],
      query: 'rainy day',
      topN: 3,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchInlineSnapshot(`
      [
        {
          "attributes": {
            "ai.documents": [
              ""sunny day at the beach"",
              ""rainy day in the city"",
              ""cloudy day in the mountains"",
            ],
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank",
            "ai.settings.maxRetries": 2,
            "ai.telemetry.functionId": "test-function-id",
            "operation.name": "ai.rerank test-function-id",
            "resource.name": "test-function-id",
          },
          "events": [],
          "name": "ai.rerank",
        },
        {
          "attributes": {
            "ai.documents": [
              ""sunny day at the beach"",
              ""rainy day in the city"",
              ""cloudy day in the mountains"",
            ],
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank.doRerank",
            "ai.ranking": [
              "{"index":2,"relevanceScore":0.9}",
              "{"index":0,"relevanceScore":0.8}",
              "{"index":1,"relevanceScore":0.7}",
            ],
            "ai.ranking.type": "text",
            "ai.settings.maxRetries": 2,
            "ai.telemetry.functionId": "test-function-id",
            "operation.name": "ai.rerank.doRerank test-function-id",
            "resource.name": "test-function-id",
          },
          "events": [],
          "name": "ai.rerank.doRerank",
        },
      ]
    `);
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    await rerank({
      model: rerankModel,
      documents: [
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ],
      query: 'rainy day',
      topN: 3,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchInlineSnapshot(`
      [
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank",
            "ai.settings.maxRetries": 2,
            "operation.name": "ai.rerank",
          },
          "events": [],
          "name": "ai.rerank",
        },
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.rerank.doRerank",
            "ai.ranking.type": "text",
            "ai.settings.maxRetries": 2,
            "operation.name": "ai.rerank.doRerank",
          },
          "events": [],
          "name": "ai.rerank.doRerank",
        },
      ]
    `);
  });
});

// --- embed integration fixtures ---

const embedDummyEmbedding = [0.1, 0.2, 0.3];
const embedTestValue = 'sunny day at the beach';

function mockEmbedSingle(
  expectedValues: Array<string>,
  embeddings: Array<Embedding>,
  usage?: EmbeddingModelUsage,
  response: Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>['response'] = {
    headers: {},
    body: {},
  },
  providerMetadata?: Awaited<
    ReturnType<EmbeddingModelV4['doEmbed']>
  >['providerMetadata'],
  warnings: Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>['warnings'] = [],
): EmbeddingModelV4['doEmbed'] {
  return async ({ values }) => {
    assert.deepStrictEqual(expectedValues, values);
    return { embeddings, usage, response, providerMetadata, warnings };
  };
}

describe('LegacyOpenTelemetry integration with embed', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbedSingle([embedTestValue], [embedDummyEmbedding]),
      }),
      value: embedTestValue,
      experimental_telemetry: {
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled', async () => {
    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbedSingle([embedTestValue], [embedDummyEmbedding], {
          tokens: 10,
        }),
      }),
      value: embedTestValue,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbedSingle([embedTestValue], [embedDummyEmbedding], {
          tokens: 10,
        }),
      }),
      value: embedTestValue,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });
});

// --- embedMany integration fixtures ---

const embedManyDummyEmbeddings = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
  [0.7, 0.8, 0.9],
];

const embedManyTestValues = [
  'sunny day at the beach',
  'rainy afternoon in the city',
  'snowy night in the mountains',
];

function mockEmbedMany(
  expectedValues: Array<string>,
  embeddings: Array<Embedding>,
  usage?: EmbeddingModelUsage,
  response: Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>['response'] = {
    headers: {},
    body: {},
  },
  providerMetadata?: Awaited<
    ReturnType<EmbeddingModelV4['doEmbed']>
  >['providerMetadata'],
): EmbeddingModelV4['doEmbed'] {
  return async ({ values }) => {
    assert.deepStrictEqual(expectedValues, values);
    return { embeddings, usage, response, providerMetadata, warnings: [] };
  };
}

describe('LegacyOpenTelemetry integration with embedMany', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbedMany(embedManyTestValues, embedManyDummyEmbeddings),
      }),
      values: embedManyTestValues,
      experimental_telemetry: {
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled (multiple calls path)', async () => {
    let callCount = 0;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async ({ values }) => {
          switch (callCount++) {
            case 0:
              assert.deepStrictEqual(values, embedManyTestValues.slice(0, 2));
              return {
                embeddings: embedManyDummyEmbeddings.slice(0, 2),
                usage: { tokens: 10 },
                warnings: [],
              };
            case 1:
              assert.deepStrictEqual(values, embedManyTestValues.slice(2));
              return {
                embeddings: embedManyDummyEmbeddings.slice(2),
                usage: { tokens: 20 },
                warnings: [],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: embedManyTestValues,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled (single call path)', async () => {
    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: null,
        doEmbed: mockEmbedMany(embedManyTestValues, embedManyDummyEmbeddings, {
          tokens: 10,
        }),
      }),
      values: embedManyTestValues,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: null,
        doEmbed: mockEmbedMany(embedManyTestValues, embedManyDummyEmbeddings, {
          tokens: 10,
        }),
      }),
      values: embedManyTestValues,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should correctly track telemetry spans for parallel doEmbed calls', async () => {
    const resolvables = [
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
    ];

    let callCount = 0;

    const embedManyPromise = embedMany({
      model: new MockEmbeddingModelV4({
        supportsParallelCalls: true,
        maxEmbeddingsPerCall: 1,
        doEmbed: async () => {
          const index = callCount++;
          await resolvables[index].promise;
          return {
            embeddings: [embedManyDummyEmbeddings[index]],
            usage: { tokens: (index + 1) * 10 },
            warnings: [],
          };
        },
      }),
      values: embedManyTestValues,
      experimental_telemetry: {
        isEnabled: true,
        integrations: [new LegacyOpenTelemetry({ tracer })],
      },
    });

    resolvables[0].resolve();
    resolvables[1].resolve();
    resolvables[2].resolve();

    await embedManyPromise;

    const doEmbedSpans = tracer.jsonSpans.filter(
      s => s.name === 'ai.embedMany.doEmbed',
    );

    expect(doEmbedSpans).toHaveLength(3);

    expect(doEmbedSpans[0].attributes['ai.usage.tokens']).toBe(10);
    expect(doEmbedSpans[1].attributes['ai.usage.tokens']).toBe(20);
    expect(doEmbedSpans[2].attributes['ai.usage.tokens']).toBe(30);
  });
});

// --- generateObject telemetry integration fixtures ---

const generateObjectDummyResponseValues = {
  finishReason: { unified: 'stop', raw: 'stop' } as const,
  usage: {
    inputTokens: {
      total: 10,
      noCache: 10,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: 20,
      text: 20,
      reasoning: undefined,
    },
  },
  response: { id: 'id-1', timestamp: new Date(123), modelId: 'm-1' },
  warnings: [],
};

describe('LegacyOpenTelemetry integration with generateObject', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    await generateObject({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          ...generateObjectDummyResponseValues,
          content: [{ type: 'text', text: '{ "content": "Hello, world!" }' }],
        }),
      }),
      schema: z.object({ content: z.string() }),
      prompt: 'prompt',
      experimental_telemetry: {
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled', async () => {
    await generateObject({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          ...generateObjectDummyResponseValues,
          content: [{ type: 'text', text: '{ "content": "Hello, world!" }' }],
          response: {
            id: 'test-id-from-model',
            timestamp: new Date(10000),
            modelId: 'test-response-model-id',
          },
          providerMetadata: {
            testProvider: {
              testKey: 'testValue',
            },
          },
        }),
      }),
      schema: z.object({ content: z.string() }),
      schemaName: 'test-name',
      schemaDescription: 'test description',
      prompt: 'prompt',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    await generateObject({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          ...generateObjectDummyResponseValues,
          content: [{ type: 'text', text: '{ "content": "Hello, world!" }' }],
          response: {
            id: 'test-id-from-model',
            timestamp: new Date(10000),
            modelId: 'test-response-model-id',
          },
        }),
      }),
      schema: z.object({ content: z.string() }),
      prompt: 'prompt',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
    });

    expect(tracer.jsonSpans).toMatchSnapshot();
  });
});

// --- streamObject telemetry integration fixtures ---

const streamObjectTestUsage: LanguageModelV4Usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: undefined,
  },
};

function createStreamObjectTestModel({
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start' as const,
      warnings: [],
    },
    {
      type: 'response-metadata' as const,
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-start' as const, id: '1' },
    { type: 'text-delta' as const, id: '1', delta: '{ ' },
    { type: 'text-delta' as const, id: '1', delta: '"content": ' },
    { type: 'text-delta' as const, id: '1', delta: '"Hello, ' },
    { type: 'text-delta' as const, id: '1', delta: 'world' },
    { type: 'text-delta' as const, id: '1', delta: '!"' },
    { type: 'text-delta' as const, id: '1', delta: ' }' },
    { type: 'text-end' as const, id: '1' },
    {
      type: 'finish' as const,
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: streamObjectTestUsage,
      providerMetadata: {
        testProvider: { testKey: 'testValue' },
      },
    },
  ]),
}: {
  stream?: ReadableStream<LanguageModelV4StreamPart>;
} = {}) {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream }),
  });
}

describe('LegacyOpenTelemetry integration with streamObject', () => {
  let tracer: IntegrationMockTracer;

  beforeEach(() => {
    tracer = new IntegrationMockTracer();
  });

  it('should record telemetry data when isEnabled is not explicitly set', async () => {
    const result = streamObject({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"content": ' },
            { type: 'text-delta', id: '1', delta: '"Hello, ' },
            { type: 'text-delta', id: '1', delta: 'world' },
            { type: 'text-delta', id: '1', delta: '!"' },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: streamObjectTestUsage,
            },
          ]),
        }),
      }),
      schema: z.object({ content: z.string() }),
      prompt: 'prompt',
      experimental_telemetry: {
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: () => 0 },
    });

    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled', async () => {
    const result = streamObject({
      model: createStreamObjectTestModel({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{ ' },
          { type: 'text-delta', id: '1', delta: '"content": ' },
          { type: 'text-delta', id: '1', delta: '"Hello, ' },
          { type: 'text-delta', id: '1', delta: 'world' },
          { type: 'text-delta', id: '1', delta: '!"' },
          { type: 'text-delta', id: '1', delta: ' }' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: streamObjectTestUsage,
            providerMetadata: {
              testProvider: {
                testKey: 'testValue',
              },
            },
          },
        ]),
      }),
      schema: z.object({ content: z.string() }),
      schemaName: 'test-name',
      schemaDescription: 'test description',
      prompt: 'prompt',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: () => 0 },
    });

    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled', async () => {
    const result = streamObject({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"content": ' },
            { type: 'text-delta', id: '1', delta: '"Hello, ' },
            { type: 'text-delta', id: '1', delta: 'world' },
            { type: 'text-delta', id: '1', delta: '!"' },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: streamObjectTestUsage,
            },
          ]),
        }),
      }),
      schema: z.object({ content: z.string() }),
      prompt: 'prompt',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: () => 0 },
    });

    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should pass correct callId to onError when doStream throws', async () => {
    const onErrorCalls: Array<{ callId: string; error: unknown }> = [];

    const result = streamObject({
      model: new MockLanguageModelV4({
        doStream: async () => {
          throw new Error('doStream failure');
        },
      }),
      schema: z.object({ content: z.string() }),
      prompt: 'prompt',
      experimental_telemetry: {
        isEnabled: true,
        integrations: {
          onStart(event: any) {
            onErrorCalls.length;
          },
          onError(event: any) {
            onErrorCalls.push(event);
          },
        },
      },
      onError: () => {},
    });

    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(onErrorCalls).toHaveLength(1);
    expect(onErrorCalls[0].callId).not.toBe('');
    expect(onErrorCalls[0].error).toBeInstanceOf(Error);
    expect((onErrorCalls[0].error as Error).message).toBe('doStream failure');
  });
});

// --- streamText stopWhen telemetry integration fixtures ---

const streamTextTestUsage: LanguageModelV4Usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: undefined,
  },
};

const streamTextTestUsage2: LanguageModelV4Usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: 10,
  },
};

describe('LegacyOpenTelemetry integration with streamText stopWhen (2 steps)', () => {
  it('should record telemetry data for each step', async () => {
    const tracer = new IntegrationMockTracer();
    let responseCount = 0;
    const result = streamText({
      model: new MockLanguageModelV4({
        doStream: async () => {
          switch (responseCount++) {
            case 0: {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'reasoning-start', id: '0' },
                  { type: 'reasoning-delta', id: '0', delta: 'thinking' },
                  { type: 'reasoning-end', id: '0' },
                  {
                    type: 'tool-call',
                    id: 'call-1',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "value" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: streamTextTestUsage,
                  },
                ]),
                response: { headers: { call: '1' } },
              };
            }
            case 1: {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(1000),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Hello, ' },
                  { type: 'text-delta', id: '1', delta: `world!` },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: streamTextTestUsage2,
                  },
                ]),
                response: { headers: { call: '2' } },
              };
            }
            default:
              throw new Error(`Unexpected response count: ${responseCount}`);
          }
        },
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        },
      },
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      stopWhen: isStepCount(3),
      _internal: {
        now: mockTwoStepStreamTextTelemetryNow(),
        generateId: mockId({ prefix: 'id' }),
        generateCallId: () => 'test-telemetry-call-id',
      },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });
});

describe('LegacyOpenTelemetry integration with streamText stopWhen (2 steps with transformed tool results)', () => {
  it('should record telemetry data for each step', async () => {
    const tracer = new IntegrationMockTracer();

    const upperCaseToolResultTransform = () =>
      new TransformStream({
        transform(chunk: any, controller: any) {
          if (chunk.type === 'tool-result' && !chunk.dynamic) {
            chunk.output = chunk.output.toUpperCase();
            chunk.input = {
              ...chunk.input,
              value: chunk.input.value.toUpperCase(),
            };
          }
          controller.enqueue(chunk);
        },
      });

    let responseCount = 0;
    const result = streamText({
      model: new MockLanguageModelV4({
        doStream: async () => {
          switch (responseCount++) {
            case 0: {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'reasoning-start', id: 'id-0' },
                  {
                    type: 'reasoning-delta',
                    id: 'id-0',
                    delta: 'thinking',
                  },
                  { type: 'reasoning-end', id: 'id-0' },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "value" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: streamTextTestUsage,
                  },
                ]),
                response: { headers: { call: '1' } },
              };
            }
            case 1: {
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(1000),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Hello, ' },
                  { type: 'text-delta', id: '1', delta: `world!` },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: streamTextTestUsage2,
                  },
                ]),
                response: { headers: { call: '2' } },
              };
            }
            default:
              throw new Error(`Unexpected response count: ${responseCount}`);
          }
        },
      }),
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        },
      },
      experimental_transform: upperCaseToolResultTransform,
      prompt: 'test-input',
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      stopWhen: isStepCount(3),
      _internal: {
        now: mockTwoStepStreamTextTelemetryNow(),
        generateId: mockId({ prefix: 'id' }),
        generateCallId: () => 'test-telemetry-call-id',
      },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchInlineSnapshot(`
      [
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.streamText",
            "ai.prompt": "{"messages":[{"role":"user","content":"test-input"}]}",
            "ai.response.finishReason": "stop",
            "ai.response.text": "Hello, world!",
            "ai.response.toolCalls": "[{"toolCallId":"call-1","toolName":"tool1","input":{"value":"value"}}]",
            "ai.settings.maxRetries": 2,
            "ai.usage.cachedInputTokens": 0,
            "ai.usage.inputTokenDetails.cacheReadTokens": 0,
            "ai.usage.inputTokenDetails.cacheWriteTokens": 0,
            "ai.usage.inputTokenDetails.noCacheTokens": 6,
            "ai.usage.inputTokens": 6,
            "ai.usage.outputTokenDetails.reasoningTokens": 10,
            "ai.usage.outputTokenDetails.textTokens": 20,
            "ai.usage.outputTokens": 20,
            "ai.usage.reasoningTokens": 10,
            "ai.usage.totalTokens": 26,
            "operation.name": "ai.streamText",
          },
          "events": [],
          "name": "ai.streamText",
        },
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.streamText.doStream",
            "ai.prompt.messages": "[{"role":"user","content":[{"type":"text","text":"test-input"}]}]",
            "ai.prompt.toolChoice": "{"type":"auto"}",
            "ai.prompt.tools": [
              "{"type":"function","name":"tool1","inputSchema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"value":{"type":"string"}},"required":["value"],"additionalProperties":false}}",
            ],
            "ai.response.avgOutputTokensPerSecond": 20,
            "ai.response.finishReason": "tool-calls",
            "ai.response.id": "id-0",
            "ai.response.model": "mock-model-id",
            "ai.response.msToFinish": 500,
            "ai.response.msToFirstChunk": 100,
            "ai.response.reasoning": "thinking",
            "ai.response.text": "",
            "ai.response.timestamp": "1970-01-01T00:00:00.000Z",
            "ai.response.toolCalls": "[{"toolCallId":"call-1","toolName":"tool1","input":{"value":"value"}}]",
            "ai.settings.maxRetries": 2,
            "ai.usage.inputTokenDetails.noCacheTokens": 3,
            "ai.usage.inputTokens": 3,
            "ai.usage.outputTokenDetails.textTokens": 10,
            "ai.usage.outputTokens": 10,
            "ai.usage.totalTokens": 13,
            "gen_ai.request.model": "mock-model-id",
            "gen_ai.response.finish_reasons": [
              "tool-calls",
            ],
            "gen_ai.response.id": "id-0",
            "gen_ai.response.model": "mock-model-id",
            "gen_ai.system": "mock-provider",
            "gen_ai.usage.input_tokens": 3,
            "gen_ai.usage.output_tokens": 10,
            "operation.name": "ai.streamText.doStream",
          },
          "events": [
            {
              "attributes": {
                "ai.response.msToFirstChunk": 100,
              },
              "name": "ai.stream.firstChunk",
            },
            {
              "attributes": {
                "ai.response.avgOutputTokensPerSecond": 20,
                "ai.response.msToFinish": 500,
              },
              "name": "ai.stream.finish",
            },
          ],
          "name": "ai.streamText.doStream",
        },
        {
          "attributes": {
            "ai.operationId": "ai.toolCall",
            "ai.toolCall.args": "{"value":"value"}",
            "ai.toolCall.id": "call-1",
            "ai.toolCall.name": "tool1",
            "ai.toolCall.result": ""result1"",
            "operation.name": "ai.toolCall",
          },
          "events": [],
          "name": "ai.toolCall",
        },
        {
          "attributes": {
            "ai.model.id": "mock-model-id",
            "ai.model.provider": "mock-provider",
            "ai.operationId": "ai.streamText.doStream",
            "ai.prompt.messages": "[{"role":"user","content":[{"type":"text","text":"test-input"}]},{"role":"assistant","content":[{"type":"reasoning","text":"thinking"},{"type":"tool-call","toolCallId":"call-1","toolName":"tool1","input":{"value":"value"}}]},{"role":"tool","content":[{"type":"tool-result","toolCallId":"call-1","toolName":"tool1","output":{"type":"text","value":"RESULT1"}}]}]",
            "ai.prompt.toolChoice": "{"type":"auto"}",
            "ai.prompt.tools": [
              "{"type":"function","name":"tool1","inputSchema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"value":{"type":"string"}},"required":["value"],"additionalProperties":false}}",
            ],
            "ai.response.avgOutputTokensPerSecond": 25,
            "ai.response.finishReason": "stop",
            "ai.response.id": "id-1",
            "ai.response.model": "mock-model-id",
            "ai.response.msToFinish": 400,
            "ai.response.msToFirstChunk": 0,
            "ai.response.text": "Hello, world!",
            "ai.response.timestamp": "1970-01-01T00:00:01.000Z",
            "ai.settings.maxRetries": 2,
            "ai.usage.cachedInputTokens": 0,
            "ai.usage.inputTokenDetails.cacheReadTokens": 0,
            "ai.usage.inputTokenDetails.cacheWriteTokens": 0,
            "ai.usage.inputTokenDetails.noCacheTokens": 3,
            "ai.usage.inputTokens": 3,
            "ai.usage.outputTokenDetails.reasoningTokens": 10,
            "ai.usage.outputTokenDetails.textTokens": 10,
            "ai.usage.outputTokens": 10,
            "ai.usage.reasoningTokens": 10,
            "ai.usage.totalTokens": 13,
            "gen_ai.request.model": "mock-model-id",
            "gen_ai.response.finish_reasons": [
              "stop",
            ],
            "gen_ai.response.id": "id-1",
            "gen_ai.response.model": "mock-model-id",
            "gen_ai.system": "mock-provider",
            "gen_ai.usage.input_tokens": 3,
            "gen_ai.usage.output_tokens": 10,
            "operation.name": "ai.streamText.doStream",
          },
          "events": [
            {
              "attributes": {
                "ai.response.msToFirstChunk": 0,
              },
              "name": "ai.stream.firstChunk",
            },
            {
              "attributes": {
                "ai.response.avgOutputTokensPerSecond": 25,
                "ai.response.msToFinish": 400,
              },
              "name": "ai.stream.finish",
            },
          ],
          "name": "ai.streamText.doStream",
        },
      ]
    `);
  });
});

describe('LegacyOpenTelemetry integration with streamText transform', () => {
  it('telemetry should record transformed data when enabled', async () => {
    const tracer = new IntegrationMockTracer();

    const upperCaseTransform = () =>
      new TransformStream({
        transform(chunk: any, controller: any) {
          if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
            chunk.text = chunk.text.toUpperCase();
          }

          if (chunk.type === 'tool-input-delta') {
            chunk.delta = chunk.delta.toUpperCase();
          }

          if (chunk.type === 'tool-call' && !chunk.dynamic) {
            chunk.input = {
              ...chunk.input,
              value: chunk.input.value.toUpperCase(),
            };
          }

          if (chunk.type === 'tool-result' && !chunk.dynamic) {
            chunk.output = chunk.output.toUpperCase();
          }

          controller.enqueue(chunk);
        },
      });

    const result = streamText({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', ' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: streamTextTestUsage,
              providerMetadata: {
                testProvider: { testKey: 'testValue' },
              },
            },
          ]),
        }),
      }),
      tools: {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => `${value}-result`,
        }),
      },
      prompt: 'test-input',
      experimental_transform: upperCaseTransform,
      experimental_telemetry: {
        isEnabled: true,
        integrations: new LegacyOpenTelemetry({ tracer }),
      },
      _internal: { now: mockTokenStreamTextTelemetryNow() },
    });

    await result.consumeStream();

    expect(tracer.jsonSpans).toMatchSnapshot();
  });
});
