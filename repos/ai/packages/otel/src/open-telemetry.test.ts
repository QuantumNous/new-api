import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  context,
  trace,
  type Attributes,
  type Span,
  type SpanOptions,
  type Tracer,
} from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { streamText, type GenerateTextEndEvent, type Telemetry } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { OpenTelemetry, type EnrichSpan } from './open-telemetry';

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

function createSdkTracer() {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  return {
    exporter,
    tracer: provider.getTracer('test-tracer'),
  };
}

function getExportedSpan(exporter: InMemorySpanExporter, name: string) {
  const span = exporter.getFinishedSpans().find(span => span.name === name);
  expect(span).toBeDefined();
  return span!;
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

function getSpanStartAttributes(
  tracer: MockTracer,
  span: MockSpan,
): Attributes {
  return getStartSpanAttributes(tracer, tracer.spans.indexOf(span));
}

function serializeSpan(span: MockSpan, tracer: MockTracer) {
  const spanIndex = tracer.spans.indexOf(span);
  const initAttributes =
    spanIndex >= 0 ? getStartSpanAttributes(tracer, spanIndex) : {};

  return {
    name: span.name,
    ended: span.ended,
    ...(span.status ? { status: span.status } : {}),
    initAttributes,
    runtimeAttributes: span.attributes,
    ...(span.events.length > 0 ? { events: span.events } : {}),
    ...(span.exceptions.length > 0 ? { exceptions: span.exceptions } : {}),
  };
}

function serializeTrace(tracer: MockTracer) {
  return tracer.spans.map(span => serializeSpan(span, tracer));
}

function parseJsonAttributes(
  attrs: Attributes,
  ...keys: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = attrs[key];
    if (typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
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

const model = { provider: 'openai.chat', modelId: 'gpt-4' };

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
    toolsContext: {},
    ...telemetryFields(),
    runtimeContext: {},
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
    include: undefined,
    output: undefined,
    runtimeContext: {},
    ...telemetryFields(),
    toolsContext: {},
    promptMessages: undefined,
    stepTools: undefined,
    stepToolChoice: undefined,
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onStepStart']>>[0];
}

function makeLanguageModelCallStartEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    provider: model.provider,
    modelId: model.modelId,
    instructions: undefined,
    messages: [],
    tools: undefined,
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onLanguageModelCallStart']>>[0];
}

function makeLanguageModelCallEndEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    provider: model.provider,
    modelId: model.modelId,
    finishReason: 'stop' as const,
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
    content: [{ type: 'text', text: 'Hello world' }],
    responseId: 'test-response-id',
    performance: {
      responseTimeMs: 1000,
      effectiveOutputTokensPerSecond: 20,
      outputTokensPerSecond: undefined,
      inputTokensPerSecond: undefined,
      effectiveTotalTokensPerSecond: 30,
      timeToFirstOutputMs: undefined,
    },
    ...overrides,
  } as Parameters<NonNullable<Telemetry['onLanguageModelCallEnd']>>[0];
}

function makeStepFinishEvent(overrides?: Record<string, unknown>) {
  return {
    callId,
    stepNumber: 0,
    model,
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
      modelId: 'gpt-4-0613',
      timestamp: new Date('2025-01-01T00:00:00Z'),
      messages: [],
    },
    providerMetadata: undefined,
    ...telemetryFields(),
    runtimeContext: {},
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

describe('OpenTelemetry', () => {
  let tracer: MockTracer;
  let integration: Telemetry;

  beforeEach(() => {
    tracer = createMockTracer();
    callId = `test-call-${++callIdCounter}`;
    integration = new OpenTelemetry({ tracer });
  });

  describe('onStart (generateText)', () => {
    it('creates root span with correct attributes', () => {
      integration.onStart!(makeOnStartEvent());

      expect(tracer.startSpan).toHaveBeenCalledTimes(1);
      expect(serializeSpan(tracer.spans[0], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          "name": "invoke_agent gpt-4",
          "runtimeAttributes": {},
        }
      `);
    });

    it('sets system_instructions when instructions are provided', () => {
      integration.onStart!(
        makeOnStartEvent({ instructions: 'You are helpful' }),
      );

      const attrs = getStartSpanAttributes(tracer, 0);
      expect(parseJsonAttributes(attrs, 'gen_ai.system_instructions'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.system_instructions": [
            {
              "content": "You are helpful",
              "type": "text",
            },
          ],
        }
      `);
    });

    it('preserves functionId as gen_ai.agent.name', () => {
      integration.onStart!(
        makeOnStartEvent({
          functionId: 'my-agent',
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 0);
      expect({
        agentName: attrs['gen_ai.agent.name'],
      }).toMatchInlineSnapshot(`
        {
          "agentName": "my-agent",
        }
      `);
    });
  });

  describe('onStepStart', () => {
    it('creates agent_step and chat spans with correct attributes', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());

      expect(tracer.startSpan).toHaveBeenCalledTimes(3);
      expect(serializeSpan(tracer.spans[1], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.operation.name": "agent_step",
          },
          "name": "step 1",
          "runtimeAttributes": {},
        }
      `);
      expect(serializeSpan(tracer.spans[2], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.operation.name": "chat",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          "name": "chat gpt-4",
          "runtimeAttributes": {},
        }
      `);
    });

    it('sets gen_ai.input.messages when messages are provided', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(
        makeLanguageModelCallStartEvent({
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 2);
      expect(parseJsonAttributes(attrs, 'gen_ai.input.messages'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.input.messages": [
            {
              "parts": [
                {
                  "content": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
        }
      `);
    });

    it('sets gen_ai.tool.definitions when tools provided', () => {
      const tools = [
        { type: 'function', name: 'get_weather', description: 'Get weather' },
      ];
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(
        makeLanguageModelCallStartEvent({ tools }),
      );

      const attrs = getStartSpanAttributes(tracer, 2);
      expect(parseJsonAttributes(attrs, 'gen_ai.tool.definitions'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.tool.definitions": [
            {
              "description": "Get weather",
              "name": "get_weather",
              "type": "function",
            },
          ],
        }
      `);
    });
  });

  describe('executeLanguageModelCall', () => {
    it('runs the model call inside the active chat span context', async () => {
      let activeSpan: Span | undefined;
      const contextWithSpy = vi
        .spyOn(context, 'with')
        .mockImplementation((nextContext, fn, thisArg, ...args) => {
          activeSpan = trace.getSpan(nextContext) ?? undefined;
          return fn.call(thisArg, ...args);
        });

      try {
        integration.onStart!(makeOnStartEvent());
        integration.onStepStart!(makeStepStartEvent());
        integration.onLanguageModelCallStart!(
          makeLanguageModelCallStartEvent(),
        );

        await expect(
          integration.executeLanguageModelCall!({
            callId,
            execute: async () => 'result',
          }),
        ).resolves.toBe('result');

        const activeSpanRecord = tracer.spans.find(span => span === activeSpan);
        expect(activeSpanRecord?.name).toBe('chat gpt-4');
      } finally {
        contextWithSpy.mockRestore();
      }
    });
  });

  describe('onStepFinish', () => {
    it('sets response attributes and token usage on the chat span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onStepFinish!(makeStepFinishEvent());

      expect(serializeSpan(tracer.spans[2], tracer)).toMatchInlineSnapshot(`
        {
          "ended": true,
          "initAttributes": {
            "gen_ai.operation.name": "chat",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          "name": "chat gpt-4",
          "runtimeAttributes": {
            "gen_ai.client.operation.duration": 1,
            "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
            "gen_ai.response.finish_reasons": [
              "stop",
            ],
            "gen_ai.response.id": "test-response-id",
            "gen_ai.usage.input_tokens": 10,
            "gen_ai.usage.output_tokens": 20,
          },
        }
      `);
    });

    it('omits malformed finish reason arrays on the chat span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({ finishReason: undefined }),
      );

      expect(
        'gen_ai.response.finish_reasons' in tracer.spans[2].attributes,
      ).toBe(false);
    });

    it('sets GenAI client performance attributes on the chat span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({
          performance: {
            responseTimeMs: 1234,
            effectiveOutputTokensPerSecond: 20,
            outputTokensPerSecond: 25,
            inputTokensPerSecond: 10,
            effectiveTotalTokensPerSecond: 30,
            timeToFirstOutputMs: 345,
            timeBetweenOutputChunksMs: {
              min: 10,
              p10: 20,
              median: 50,
              avg: 67,
              p90: 90,
              max: 100,
            },
          },
        }),
      );

      expect({
        duration:
          tracer.spans[2].attributes['gen_ai.client.operation.duration'],
        timeToFirstChunk:
          tracer.spans[2].attributes[
            'gen_ai.client.operation.time_to_first_chunk'
          ],
        timePerOutputChunk:
          tracer.spans[2].attributes[
            'gen_ai.client.operation.time_per_output_chunk'
          ],
      }).toMatchInlineSnapshot(`
        {
          "duration": 1.234,
          "timePerOutputChunk": 0.067,
          "timeToFirstChunk": 0.345,
        }
      `);
    });

    it('formats output messages in SemConv format', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onStepFinish!(makeStepFinishEvent());

      const chatSpan = tracer.spans[2];
      expect(parseJsonAttributes(chatSpan.attributes, 'gen_ai.output.messages'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.output.messages": [
            {
              "finish_reason": "stop",
              "parts": [
                {
                  "content": "Hello world",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
        }
      `);
    });

    it('includes tool calls in output messages', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'tc1',
              toolName: 'search',
              input: { q: 'test' },
            },
          ],
          finishReason: 'tool-calls',
        }),
      );
      integration.onStepFinish!(
        makeStepFinishEvent({
          text: undefined,
          toolCalls: [
            {
              type: 'tool-call' as const,
              toolCallId: 'tc1',
              toolName: 'search',
              input: { q: 'test' },
            },
          ],
          finishReason: 'tool-calls',
        }),
      );

      const chatSpan = tracer.spans[2];
      expect(parseJsonAttributes(chatSpan.attributes, 'gen_ai.output.messages'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.output.messages": [
            {
              "finish_reason": "tool_call",
              "parts": [
                {
                  "arguments": {
                    "q": "test",
                  },
                  "id": "tc1",
                  "name": "search",
                  "type": "tool_call",
                },
              ],
              "role": "assistant",
            },
          ],
        }
      `);
    });

    it('sets cache token attributes when available', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            inputTokenDetails: {
              noCacheTokens: 70,
              cacheReadTokens: 20,
              cacheWriteTokens: 10,
            },
            outputTokenDetails: {
              textTokens: 40,
              reasoningTokens: 10,
            },
          },
        }),
      );
      integration.onStepFinish!(
        makeStepFinishEvent({
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            inputTokenDetails: {
              noCacheTokens: 70,
              cacheReadTokens: 20,
              cacheWriteTokens: 10,
            },
            outputTokenDetails: {
              textTokens: 40,
              reasoningTokens: 10,
            },
          },
        }),
      );

      const chatSpan = tracer.spans[2];
      expect({
        inputTokens: chatSpan.attributes['gen_ai.usage.input_tokens'],
        outputTokens: chatSpan.attributes['gen_ai.usage.output_tokens'],
        cacheRead: chatSpan.attributes['gen_ai.usage.cache_read.input_tokens'],
        cacheCreation:
          chatSpan.attributes['gen_ai.usage.cache_creation.input_tokens'],
      }).toMatchInlineSnapshot(`
        {
          "cacheCreation": 10,
          "cacheRead": 20,
          "inputTokens": 100,
          "outputTokens": 50,
        }
      `);
    });
  });

  describe('onToolExecutionStart / onToolExecutionEnd', () => {
    it('creates an execute_tool span with correct attributes', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());

      expect(tracer.spans).toHaveLength(4);
      expect(serializeSpan(tracer.spans[3], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.call.arguments": "{"query":"test"}",
            "gen_ai.tool.call.id": "tool-call-1",
            "gen_ai.tool.name": "myTool",
            "gen_ai.tool.type": "function",
          },
          "name": "execute_tool myTool",
          "runtimeAttributes": {},
        }
      `);
    });

    it('parents chat and execute_tool spans under the same step span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());

      const mock = tracer.startSpan as ReturnType<typeof vi.fn>;
      expect(mock.mock.calls[2][2]).toBe(mock.mock.calls[3][2]);
    });

    it('parents execute_tool under the root span before a step starts', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());

      const mock = tracer.startSpan as ReturnType<typeof vi.fn>;
      const toolParentContext = mock.mock.calls[1][2];

      expect(trace.getSpan(toolParentContext)).toBe(tracer.spans[0]);
    });

    it('sets gen_ai.tool.call.result on success', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));

      expect(serializeSpan(tracer.spans[3], tracer)).toMatchInlineSnapshot(`
        {
          "ended": true,
          "initAttributes": {
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.call.arguments": "{"query":"test"}",
            "gen_ai.tool.call.id": "tool-call-1",
            "gen_ai.tool.name": "myTool",
            "gen_ai.tool.type": "function",
          },
          "name": "execute_tool myTool",
          "runtimeAttributes": {
            "gen_ai.execute_tool.duration": 0.042,
            "gen_ai.tool.call.result": "{"result":"ok"}",
          },
        }
      `);
    });

    it('sets GenAI execute_tool duration on the tool span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(
        makeToolCallFinishEvent(true, { toolExecutionMs: 123 }),
      );

      expect(tracer.spans[3].attributes['gen_ai.execute_tool.duration']).toBe(
        0.123,
      );
    });

    it('records error on tool failure', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(false));

      const toolSpan = tracer.spans[3];
      expect({
        status: toolSpan.status,
        ended: toolSpan.ended,
      }).toMatchInlineSnapshot(`
        {
          "ended": true,
          "status": {
            "code": 2,
            "message": "tool failed",
          },
        }
      `);
    });
  });

  describe('onEnd (generateText)', () => {
    it('sets total usage and output on root span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      expect(serializeSpan(tracer.spans[0], tracer)).toMatchInlineSnapshot(`
        {
          "ended": true,
          "initAttributes": {
            "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          "name": "invoke_agent gpt-4",
          "runtimeAttributes": {
            "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
            "gen_ai.response.finish_reasons": [
              "stop",
            ],
            "gen_ai.usage.input_tokens": 10,
            "gen_ai.usage.output_tokens": 20,
          },
        }
      `);
    });

    it('formats output messages on root span', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      const rootSpan = tracer.spans[0];
      expect(parseJsonAttributes(rootSpan.attributes, 'gen_ai.output.messages'))
        .toMatchInlineSnapshot(`
        {
          "gen_ai.output.messages": [
            {
              "finish_reason": "stop",
              "parts": [
                {
                  "content": "Hello world",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
        }
      `);
    });
  });

  describe('onStart (generateObject)', () => {
    it('creates a root span with output.type json', () => {
      integration.onStart!(
        makeOnStartEvent({
          operationId: 'ai.generateObject',
          schema: { type: 'object' },
          schemaName: 'TestSchema',
          schemaDescription: 'A test schema',
          output: 'object',
        }),
      );

      const attrs = getStartSpanAttributes(tracer, 0);
      expect({
        operationName: attrs['gen_ai.operation.name'],
        outputType: attrs['gen_ai.output.type'],
      }).toMatchInlineSnapshot(`
        {
          "operationName": "invoke_agent",
          "outputType": "json",
        }
      `);
    });
  });

  describe('onStart (embed)', () => {
    it('creates an embeddings span', () => {
      integration.onStart!(
        makeOnStartEvent({
          operationId: 'ai.embed',
          value: 'test text',
        }),
      );

      expect(serializeSpan(tracer.spans[0], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.operation.name": "embeddings",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.model": "gpt-4",
          },
          "name": "embeddings gpt-4",
          "runtimeAttributes": {},
        }
      `);
    });
  });

  describe('onStart (rerank)', () => {
    it('creates a rerank span', () => {
      integration.onStart!(
        makeOnStartEvent({
          operationId: 'ai.rerank',
          documents: [{ text: 'doc1' }],
        }),
      );

      expect(serializeSpan(tracer.spans[0], tracer)).toMatchInlineSnapshot(`
        {
          "ended": false,
          "initAttributes": {
            "gen_ai.operation.name": "rerank",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.model": "gpt-4",
          },
          "name": "rerank gpt-4",
          "runtimeAttributes": {},
        }
      `);
    });
  });

  describe('enrichSpan', () => {
    it('adds custom attributes to created spans', () => {
      const enrichSpan = vi.fn<EnrichSpan>(({ spanType, runtimeContext }) => {
        const userId = runtimeContext?.userId;

        return {
          'custom.span_type': spanType,
          ...(typeof userId === 'string' ? { 'custom.user_id': userId } : {}),
          'gen_ai.operation.name': 'custom_operation',
        };
      });

      integration = new OpenTelemetry({
        tracer,
        enrichSpan,
      });

      integration.onStart!(
        makeOnStartEvent({
          runtimeContext: { userId: 'root-user' },
        }),
      );
      integration.onStepStart!(
        makeStepStartEvent({
          runtimeContext: { userId: 'step-user' },
        }),
      );
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());

      expect(tracer.spans.map(span => getSpanStartAttributes(tracer, span)))
        .toMatchInlineSnapshot(`
        [
          {
            "custom.span_type": "operation",
            "custom.user_id": "root-user",
            "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          {
            "custom.span_type": "step",
            "custom.user_id": "step-user",
            "gen_ai.operation.name": "agent_step",
          },
          {
            "custom.span_type": "languageModel",
            "custom.user_id": "step-user",
            "gen_ai.operation.name": "chat",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.max_tokens": 100,
            "gen_ai.request.model": "gpt-4",
            "gen_ai.request.temperature": 0.7,
          },
          {
            "custom.span_type": "tool",
            "custom.user_id": "step-user",
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.call.arguments": "{"query":"test"}",
            "gen_ai.tool.call.id": "tool-call-1",
            "gen_ai.tool.name": "myTool",
            "gen_ai.tool.type": "function",
          },
        ]
      `);

      expect(enrichSpan.mock.calls.map(([args]) => args)).toEqual([
        {
          callId,
          operationId: 'ai.generateText',
          runtimeContext: { userId: 'root-user' },
          spanType: 'operation',
        },
        {
          callId,
          operationId: 'ai.generateText',
          runtimeContext: { userId: 'step-user' },
          spanType: 'step',
        },
        {
          callId,
          operationId: 'ai.generateText',
          runtimeContext: { userId: 'step-user' },
          spanType: 'languageModel',
        },
        {
          callId,
          operationId: 'ai.generateText',
          runtimeContext: { userId: 'step-user' },
          spanType: 'tool',
        },
      ]);
    });

    it('ignores enrichment callback errors', () => {
      integration = new OpenTelemetry({
        tracer,
        enrichSpan: () => {
          throw new Error('custom attribute failure');
        },
      });

      integration.onStart!(makeOnStartEvent());

      expect(getStartSpanAttributes(tracer, 0)).toMatchInlineSnapshot(`
        {
          "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
          "gen_ai.operation.name": "invoke_agent",
          "gen_ai.provider.name": "openai",
          "gen_ai.request.max_tokens": 100,
          "gen_ai.request.model": "gpt-4",
          "gen_ai.request.temperature": 0.7,
        }
      `);
    });
  });

  describe('supplemental attributes', () => {
    it('exports flat runtime context attribute keys', () => {
      const sdkTrace = createSdkTracer();
      integration = new OpenTelemetry({
        tracer: sdkTrace.tracer,
        runtimeContext: true,
      });

      integration.onStart!(
        makeOnStartEvent({
          runtimeContext: { 'foo.bar': 'baz' },
        }),
      );
      integration.onEnd!(makeFinishEvent());

      const rootSpan = getExportedSpan(sdkTrace.exporter, 'invoke_agent gpt-4');
      expect({
        'ai.settings.context.foo.bar':
          rootSpan.attributes['ai.settings.context.foo.bar'],
      }).toMatchInlineSnapshot(`
        {
          "ai.settings.context.foo.bar": "baz",
        }
      `);
    });

    it('exports nested runtime context attributes', () => {
      const sdkTrace = createSdkTracer();
      integration = new OpenTelemetry({
        tracer: sdkTrace.tracer,
        runtimeContext: true,
      });

      integration.onStart!(
        makeOnStartEvent({
          runtimeContext: { foo: { bar: 'baz' } },
        }),
      );
      integration.onEnd!(makeFinishEvent());

      const rootSpan = getExportedSpan(sdkTrace.exporter, 'invoke_agent gpt-4');
      expect({
        'ai.settings.context.foo.bar':
          rootSpan.attributes['ai.settings.context.foo.bar'],
      }).toMatchInlineSnapshot(`
        {
          "ai.settings.context.foo.bar": "baz",
        }
      `);
    });

    it('emits supplemental AI SDK attributes on existing spans when enabled', () => {
      integration = new OpenTelemetry({
        tracer,
        usage: true,
        providerMetadata: true,
        embedding: true,
        reranking: true,
        runtimeContext: true,
        headers: true,
        toolChoice: true,
        schema: true,
      });

      const detailedUsage = {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        inputTokenDetails: {
          noCacheTokens: 7,
          cacheReadTokens: 2,
          cacheWriteTokens: 1,
        },
        outputTokenDetails: {
          textTokens: 15,
          reasoningTokens: 5,
        },
      };

      integration.onStart!(
        makeOnStartEvent({
          headers: { 'x-request-id': 'request-123' },
          runtimeContext: { userId: 'user-123' },
        }),
      );
      integration.onStepStart!(
        makeStepStartEvent({
          stepToolChoice: { type: 'auto' },
        }),
      );
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({ usage: detailedUsage }),
      );
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(
        makeStepFinishEvent({
          usage: detailedUsage,
          providerMetadata: { openai: { response: 'metadata' } },
        }),
      );
      integration.onEnd!(
        makeFinishEvent({
          usage: detailedUsage,
          providerMetadata: { openai: { response: 'metadata' } },
        }),
      );

      expect(serializeTrace(tracer)).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "initAttributes": {
              "ai.request.headers.x-request-id": "request-123",
              "ai.settings.context.userId": "user-123",
              "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
              "gen_ai.operation.name": "invoke_agent",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "invoke_agent gpt-4",
            "runtimeAttributes": {
              "ai.response.providerMetadata": "{"openai":{"response":"metadata"}}",
              "ai.usage.inputTokenDetails.noCacheTokens": 7,
              "ai.usage.outputTokenDetails.reasoningTokens": 5,
              "ai.usage.outputTokenDetails.textTokens": 15,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.usage.cache_creation.input_tokens": 1,
              "gen_ai.usage.cache_read.input_tokens": 2,
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "ai.prompt.toolChoice": "{"type":"auto"}",
              "ai.request.headers.x-request-id": "request-123",
              "ai.settings.context.userId": "user-123",
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 1",
            "runtimeAttributes": {
              "ai.response.providerMetadata": "{"openai":{"response":"metadata"}}",
              "ai.usage.inputTokenDetails.noCacheTokens": 7,
              "ai.usage.outputTokenDetails.reasoningTokens": 5,
              "ai.usage.outputTokenDetails.textTokens": 15,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "chat",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "chat gpt-4",
            "runtimeAttributes": {
              "ai.usage.inputTokenDetails.noCacheTokens": 7,
              "ai.usage.outputTokenDetails.reasoningTokens": 5,
              "ai.usage.outputTokenDetails.textTokens": 15,
              "gen_ai.client.operation.duration": 1,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.response.id": "test-response-id",
              "gen_ai.usage.cache_creation.input_tokens": 1,
              "gen_ai.usage.cache_read.input_tokens": 2,
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "execute_tool",
              "gen_ai.tool.call.arguments": "{"query":"test"}",
              "gen_ai.tool.call.id": "tool-call-1",
              "gen_ai.tool.name": "myTool",
              "gen_ai.tool.type": "function",
            },
            "name": "execute_tool myTool",
            "runtimeAttributes": {
              "gen_ai.execute_tool.duration": 0.042,
              "gen_ai.tool.call.result": "{"result":"ok"}",
            },
          },
        ]
      `);
    });

    it('only emits explicitly enabled supplemental attributes', () => {
      integration = new OpenTelemetry({
        tracer,
        runtimeContext: true,
        providerMetadata: true,
        usage: true,
      });

      integration.onStart!(
        makeOnStartEvent({
          headers: { authorization: 'secret' },
          runtimeContext: { userId: 'user-123' },
        }),
      );
      integration.onStepStart!(
        makeStepStartEvent({
          promptMessages: [
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        }),
      );
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      expect(serializeTrace(tracer)).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "initAttributes": {
              "ai.settings.context.userId": "user-123",
              "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
              "gen_ai.operation.name": "invoke_agent",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "invoke_agent gpt-4",
            "runtimeAttributes": {
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "ai.settings.context.userId": "user-123",
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 1",
            "runtimeAttributes": {},
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "chat",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "chat gpt-4",
            "runtimeAttributes": {
              "gen_ai.client.operation.duration": 1,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.response.id": "test-response-id",
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "execute_tool",
              "gen_ai.tool.call.arguments": "{"query":"test"}",
              "gen_ai.tool.call.id": "tool-call-1",
              "gen_ai.tool.name": "myTool",
              "gen_ai.tool.type": "function",
            },
            "name": "execute_tool myTool",
            "runtimeAttributes": {
              "gen_ai.execute_tool.duration": 0.042,
              "gen_ai.tool.call.result": "{"result":"ok"}",
            },
          },
        ]
      `);
    });

    it('does not emit disabled supplemental attributes', () => {
      integration = new OpenTelemetry({
        tracer,
        usage: true,
      });

      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      expect(serializeTrace(tracer)).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
              "gen_ai.operation.name": "invoke_agent",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "invoke_agent gpt-4",
            "runtimeAttributes": {
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 1",
            "runtimeAttributes": {},
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "execute_tool",
              "gen_ai.tool.call.arguments": "{"query":"test"}",
              "gen_ai.tool.call.id": "tool-call-1",
              "gen_ai.tool.name": "myTool",
              "gen_ai.tool.type": "function",
            },
            "name": "execute_tool myTool",
            "runtimeAttributes": {
              "gen_ai.execute_tool.duration": 0.042,
              "gen_ai.tool.call.result": "{"result":"ok"}",
            },
          },
        ]
      `);
    });
  });

  describe('onError', () => {
    it('records error on root, step, and chat spans', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());

      integration.onError!({
        callId,
        error: new Error('something went wrong'),
      });

      expect(
        tracer.spans.map(s => ({
          name: s.name,
          status: s.status,
          ended: s.ended,
        })),
      ).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "name": "invoke_agent gpt-4",
            "status": {
              "code": 2,
              "message": "something went wrong",
            },
          },
          {
            "ended": true,
            "name": "step 1",
            "status": {
              "code": 2,
              "message": "something went wrong",
            },
          },
          {
            "ended": true,
            "name": "chat gpt-4",
            "status": {
              "code": 2,
              "message": "something went wrong",
            },
          },
        ]
      `);
    });
  });

  describe('abort', () => {
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
          integrations: integration,
        },
      });

      await result.consumeStream();

      expect(
        tracer.spans.map(span => ({
          name: span.name,
          ended: span.ended,
        })),
      ).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "name": "invoke_agent mock-model-id",
          },
          {
            "ended": true,
            "name": "step 1",
          },
          {
            "ended": true,
            "name": "chat mock-model-id",
          },
        ]
      `);
    });
  });

  describe('full lifecycle', () => {
    it('creates correct span hierarchy for multi-step tool loop', () => {
      integration.onStart!(makeOnStartEvent());

      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(
        makeLanguageModelCallStartEvent({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({
          finishReason: 'tool-calls',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'tool-call-1',
              toolName: 'myTool',
              input: { query: 'test' },
            },
          ],
        }),
      );
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(
        makeStepFinishEvent({
          finishReason: 'tool-calls',
          toolCalls: [
            {
              type: 'tool-call' as const,
              toolCallId: 'tool-call-1',
              toolName: 'myTool',
              input: { query: 'test' },
            },
          ],
          text: undefined,
        }),
      );

      integration.onStepStart!(makeStepStartEvent({ steps: [{}] }));
      integration.onLanguageModelCallStart!(
        makeLanguageModelCallStartEvent({
          messages: [{ role: 'assistant', content: 'Tool result received' }],
        }),
      );
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onStepFinish!(makeStepFinishEvent({ stepNumber: 1 }));

      integration.onEnd!(makeFinishEvent());

      expect(
        tracer.spans.map(s => ({
          name: s.name,
          ended: s.ended,
        })),
      ).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "name": "invoke_agent gpt-4",
          },
          {
            "ended": true,
            "name": "step 1",
          },
          {
            "ended": true,
            "name": "chat gpt-4",
          },
          {
            "ended": true,
            "name": "execute_tool myTool",
          },
          {
            "ended": true,
            "name": "step 2",
          },
          {
            "ended": true,
            "name": "chat gpt-4",
          },
        ]
      `);
    });

    it('full trace snapshot for single-step generateText', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      expect(serializeTrace(tracer)).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
              "gen_ai.operation.name": "invoke_agent",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "invoke_agent gpt-4",
            "runtimeAttributes": {
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 1",
            "runtimeAttributes": {},
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "chat",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "chat gpt-4",
            "runtimeAttributes": {
              "gen_ai.client.operation.duration": 1,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.response.id": "test-response-id",
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
        ]
      `);
    });

    it('full trace snapshot for multi-step tool loop', () => {
      integration.onStart!(makeOnStartEvent());

      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(
        makeLanguageModelCallEndEvent({
          finishReason: 'tool-calls',
        }),
      );
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(
        makeStepFinishEvent({
          finishReason: 'tool-calls',
          toolCalls: [
            {
              type: 'tool-call' as const,
              toolCallId: 'tool-call-1',
              toolName: 'myTool',
              input: { query: 'test' },
            },
          ],
          text: undefined,
        }),
      );

      integration.onStepStart!(makeStepStartEvent({ steps: [{}] }));
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onStepFinish!(makeStepFinishEvent({ stepNumber: 1 }));

      integration.onEnd!(makeFinishEvent());

      expect(serializeTrace(tracer)).toMatchInlineSnapshot(`
        [
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.input.messages": "[{"role":"user","parts":[{"type":"text","content":"Hello"}]}]",
              "gen_ai.operation.name": "invoke_agent",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "invoke_agent gpt-4",
            "runtimeAttributes": {
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 1",
            "runtimeAttributes": {},
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "chat",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "chat gpt-4",
            "runtimeAttributes": {
              "gen_ai.client.operation.duration": 1,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"tool_call"}]",
              "gen_ai.response.finish_reasons": [
                "tool-calls",
              ],
              "gen_ai.response.id": "test-response-id",
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "execute_tool",
              "gen_ai.tool.call.arguments": "{"query":"test"}",
              "gen_ai.tool.call.id": "tool-call-1",
              "gen_ai.tool.name": "myTool",
              "gen_ai.tool.type": "function",
            },
            "name": "execute_tool myTool",
            "runtimeAttributes": {
              "gen_ai.execute_tool.duration": 0.042,
              "gen_ai.tool.call.result": "{"result":"ok"}",
            },
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "agent_step",
            },
            "name": "step 2",
            "runtimeAttributes": {},
          },
          {
            "ended": true,
            "initAttributes": {
              "gen_ai.operation.name": "chat",
              "gen_ai.provider.name": "openai",
              "gen_ai.request.max_tokens": 100,
              "gen_ai.request.model": "gpt-4",
              "gen_ai.request.temperature": 0.7,
            },
            "name": "chat gpt-4",
            "runtimeAttributes": {
              "gen_ai.client.operation.duration": 1,
              "gen_ai.output.messages": "[{"role":"assistant","parts":[{"type":"text","content":"Hello world"}],"finish_reason":"stop"}]",
              "gen_ai.response.finish_reasons": [
                "stop",
              ],
              "gen_ai.response.id": "test-response-id",
              "gen_ai.usage.input_tokens": 10,
              "gen_ai.usage.output_tokens": 20,
            },
          },
        ]
      `);
    });

    it('does not use ai.* attribute prefix anywhere', () => {
      integration.onStart!(makeOnStartEvent());
      integration.onStepStart!(makeStepStartEvent());
      integration.onLanguageModelCallStart!(makeLanguageModelCallStartEvent());
      integration.onLanguageModelCallEnd!(makeLanguageModelCallEndEvent());
      integration.onToolExecutionStart!(makeToolCallStartEvent());
      integration.onToolExecutionEnd!(makeToolCallFinishEvent(true));
      integration.onStepFinish!(makeStepFinishEvent());
      integration.onEnd!(makeFinishEvent());

      for (const span of tracer.spans) {
        for (const key of Object.keys(span.attributes)) {
          expect(key).not.toMatch(/^ai\./);
        }
      }
    });
  });
});
