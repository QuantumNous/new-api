import { AsyncLocalStorage } from 'node:async_hooks';
import * as diagnosticsChannel from 'node:diagnostics_channel';
import { tool } from '@ai-sdk/provider-utils';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { embed } from '../embed/embed';
import { embedMany } from '../embed/embed-many';
import { generateText } from '../generate-text';
import { streamText } from '../generate-text/stream-text';
import { isStepCount } from '../generate-text/stop-condition';
import { rerank } from '../rerank/rerank';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { createTelemetryDispatcher } from './create-telemetry-dispatcher';
import {
  AI_SDK_TELEMETRY_TRACING_CHANNEL,
  type TelemetryTracingChannelMessage,
} from './tracing-channel';
import { isNodeRuntime } from '../util/is-node-runtime';

type TelemetryTracingChannelAsyncEndMessage = TelemetryTracingChannelMessage & {
  result?: unknown;
};

async function collectTracingChannelStartMessages(
  run: () => Promise<void>,
): Promise<TelemetryTracingChannelMessage[]> {
  const messages: TelemetryTracingChannelMessage[] = [];
  const subscriber = (message: unknown) => {
    const telemetry = message as TelemetryTracingChannelMessage;
    messages.push({
      type: telemetry.type,
      event:
        telemetry.event != null && typeof telemetry.event === 'object'
          ? { ...telemetry.event }
          : telemetry.event,
    });
  };

  const tracingChannel = diagnosticsChannel.tracingChannel(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );
  const subscribers = {
    start: subscriber,
    end() {},
    asyncStart() {},
    asyncEnd() {},
    error() {},
  };

  tracingChannel.subscribe(subscribers);

  try {
    await run();
  } finally {
    tracingChannel.unsubscribe(subscribers);
  }

  return messages;
}

async function collectTracingChannelEventSequence(
  run: () => Promise<void>,
): Promise<string[]> {
  const events: string[] = [];
  const store = new AsyncLocalStorage<TelemetryTracingChannelMessage>();

  const tracingChannel = diagnosticsChannel.tracingChannel(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );
  const subscribers = {
    start() {},
    end() {},
    asyncStart() {},
    asyncEnd(message: unknown) {
      events.push(
        `asyncEnd ${(message as TelemetryTracingChannelMessage).type}`,
      );
    },
    error() {},
  };

  tracingChannel.start.bindStore(store, message => {
    events.push(
      `bindStart ${(message as TelemetryTracingChannelMessage).type}`,
    );
    return message as TelemetryTracingChannelMessage;
  });
  tracingChannel.subscribe(subscribers);

  try {
    await run();
  } finally {
    tracingChannel.unsubscribe(subscribers);
    tracingChannel.start.unbindStore(store);
  }

  return events;
}

async function collectTracingChannelAsyncEndMessages(
  run: () => Promise<void>,
): Promise<TelemetryTracingChannelAsyncEndMessage[]> {
  const messages: TelemetryTracingChannelAsyncEndMessage[] = [];

  const tracingChannel = diagnosticsChannel.tracingChannel(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );
  const subscribers = {
    start() {},
    end() {},
    asyncStart() {},
    asyncEnd(message: unknown) {
      messages.push(message as TelemetryTracingChannelAsyncEndMessage);
    },
    error() {},
  };

  tracingChannel.subscribe(subscribers);

  try {
    await run();
  } finally {
    tracingChannel.unsubscribe(subscribers);
  }

  return messages;
}

async function collectTracingChannelParentage(
  run: () => Promise<void>,
): Promise<string[]> {
  const events: string[] = [];
  const store = new AsyncLocalStorage<TelemetryTracingChannelMessage>();

  const tracingChannel = diagnosticsChannel.tracingChannel(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );
  const subscribers = {
    start() {},
    end() {},
    asyncStart() {},
    asyncEnd() {},
    error() {},
  };

  tracingChannel.start.bindStore(store, message => {
    const telemetry = message as TelemetryTracingChannelMessage;
    events.push(
      `${telemetry.type} parent ${store.getStore()?.type ?? 'undefined'}`,
    );
    return telemetry;
  });
  tracingChannel.subscribe(subscribers);

  try {
    await run();
  } finally {
    tracingChannel.unsubscribe(subscribers);
    tracingChannel.start.unbindStore(store);
  }

  return events;
}

describe.runIf(isNodeRuntime())('telemetry tracing channel publisher', () => {
  beforeEach(() => {
    globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
  });

  it('does not trace callback-only lifecycle events', async () => {
    const event = { callId: 'tracing-channel-callback-only' };

    const messages = await collectTracingChannelStartMessages(async () => {
      const telemetry = createTelemetryDispatcher({});

      await telemetry.onStart!(event as any);
    });

    expect(messages).toEqual([]);
  });

  it('does not trace semantic spans when telemetry is disabled', async () => {
    const event = { callId: 'tracing-channel-disabled' };

    const messages = await collectTracingChannelStartMessages(async () => {
      const telemetry = createTelemetryDispatcher({
        telemetry: { isEnabled: false },
      });

      await telemetry.runInTracingChannelSpan?.({
        type: 'generateText',
        event,
        execute: async () => undefined,
      });
    });

    expect(messages).toEqual([]);
  });

  it('traces semantic spans with telemetry settings', async () => {
    const event = { callId: 'tracing-channel-generate-text' };

    const messages = await collectTracingChannelStartMessages(async () => {
      const telemetry = createTelemetryDispatcher({
        telemetry: { functionId: 'enabled-function' },
      });

      await telemetry.runInTracingChannelSpan!({
        type: 'generateText',
        event,
        execute: async () => undefined,
      });
    });

    expect(messages).toMatchInlineSnapshot(`
      [
        {
          "event": {
            "callId": "tracing-channel-generate-text",
            "functionId": "enabled-function",
            "recordInputs": undefined,
            "recordOutputs": undefined,
          },
          "type": "generateText",
        },
      ]
    `);
  });

  it('propagates language model execution context through async work', async () => {
    const store = new AsyncLocalStorage<TelemetryTracingChannelMessage>();
    const tracingChannel = diagnosticsChannel.tracingChannel(
      AI_SDK_TELEMETRY_TRACING_CHANNEL,
    );
    const subscribers = {
      start() {},
      end() {},
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    let capturedContext: TelemetryTracingChannelMessage | undefined;

    tracingChannel.start.bindStore(
      store,
      message => message as TelemetryTracingChannelMessage,
    );
    tracingChannel.subscribe(subscribers);

    try {
      const telemetry = createTelemetryDispatcher({
        telemetry: { functionId: 'execution-function' },
      });

      await telemetry.runInTracingChannelSpan!({
        type: 'languageModelCall',
        event: {
          callId: 'language-model-call',
          provider: 'mock-provider',
          modelId: 'mock-model',
        },
        execute: async () => {
          await Promise.resolve();
          capturedContext = store.getStore();
          return 'result';
        },
      });
    } finally {
      tracingChannel.unsubscribe(subscribers);
      tracingChannel.start.unbindStore(store);
    }

    expect(capturedContext).toMatchInlineSnapshot(`
      {
        "event": {
          "callId": "language-model-call",
          "functionId": "execution-function",
          "modelId": "mock-model",
          "provider": "mock-provider",
          "recordInputs": undefined,
          "recordOutputs": undefined,
        },
        "result": "result",
        "type": "languageModelCall",
      }
    `);
  });

  it('propagates tool execution context through async work', async () => {
    const store = new AsyncLocalStorage<TelemetryTracingChannelMessage>();
    const tracingChannel = diagnosticsChannel.tracingChannel(
      AI_SDK_TELEMETRY_TRACING_CHANNEL,
    );
    const subscribers = {
      start() {},
      end() {},
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    let capturedContext: TelemetryTracingChannelMessage | undefined;

    tracingChannel.start.bindStore(
      store,
      message => message as TelemetryTracingChannelMessage,
    );
    tracingChannel.subscribe(subscribers);

    try {
      const telemetry = createTelemetryDispatcher({
        telemetry: { functionId: 'execution-function' },
      });

      await telemetry.runInTracingChannelSpan!({
        type: 'executeTool',
        event: {
          callId: 'tool-call',
          toolCall: {
            type: 'tool-call',
            toolCallId: 'tool-call-id',
            toolName: 'mockTool',
            input: {},
            dynamic: false,
          },
          messages: [],
          toolContext: undefined,
        } as any,
        execute: async () => {
          await Promise.resolve();
          capturedContext = store.getStore();
          return 'result';
        },
      });
    } finally {
      tracingChannel.unsubscribe(subscribers);
      tracingChannel.start.unbindStore(store);
    }

    expect(capturedContext).toMatchInlineSnapshot(`
      {
        "event": {
          "callId": "tool-call",
          "functionId": "execution-function",
          "messages": [],
          "recordInputs": undefined,
          "recordOutputs": undefined,
          "toolCall": {
            "dynamic": false,
            "input": {},
            "toolCallId": "tool-call-id",
            "toolName": "mockTool",
            "type": "tool-call",
          },
          "toolContext": undefined,
        },
        "result": "result",
        "type": "executeTool",
      }
    `);
  });

  it('traces the current generateText lifecycle sequence with a tool call', async () => {
    let responseCount = 0;

    const sequence = await collectTracingChannelEventSequence(async () => {
      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  usage: {
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
                  },
                  warnings: [],
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'weather-tool-call',
                      toolName: 'weather',
                      input: JSON.stringify({ city: 'San Francisco' }),
                    },
                  ],
                };

              case 1:
                return {
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 5,
                      noCache: 5,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 7,
                      text: 7,
                      reasoning: undefined,
                    },
                  },
                  warnings: [],
                  content: [{ type: 'text', text: 'It is sunny.' }],
                };

              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        prompt: 'What is the weather in San Francisco?',
        stopWhen: isStepCount(3),
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }) => `Weather in ${city}: sunny`,
          }),
        },
        telemetry: {
          functionId: 'tracing-channel-generate-text-test',
        },
      });
    });

    expect(sequence).toMatchInlineSnapshot(`
      [
        "bindStart generateText",
        "bindStart step",
        "bindStart languageModelCall",
        "asyncEnd languageModelCall",
        "bindStart executeTool",
        "asyncEnd executeTool",
        "asyncEnd step",
        "bindStart step",
        "bindStart languageModelCall",
        "asyncEnd languageModelCall",
        "asyncEnd step",
        "asyncEnd generateText",
      ]
    `);
  });

  it('traces the current streamText lifecycle sequence with a tool call', async () => {
    let responseCount = 0;

    const sequence = await collectTracingChannelEventSequence(async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'tool-call',
                      toolCallId: 'weather-tool-call',
                      toolName: 'weather',
                      input: JSON.stringify({ city: 'San Francisco' }),
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: {
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
                      },
                    },
                  ]),
                };

              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'It is sunny.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: {
                        inputTokens: {
                          total: 5,
                          noCache: 5,
                          cacheRead: undefined,
                          cacheWrite: undefined,
                        },
                        outputTokens: {
                          total: 7,
                          text: 7,
                          reasoning: undefined,
                        },
                      },
                    },
                  ]),
                };

              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        prompt: 'What is the weather in San Francisco?',
        stopWhen: isStepCount(3),
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }) => `Weather in ${city}: sunny`,
          }),
        },
        telemetry: {
          functionId: 'tracing-channel-stream-text-test',
        },
      });

      await result.consumeStream();
    });

    expect(sequence).toMatchInlineSnapshot(`
      [
        "bindStart streamText",
        "bindStart step",
        "bindStart languageModelCall",
        "asyncEnd languageModelCall",
        "bindStart executeTool",
        "asyncEnd executeTool",
        "asyncEnd step",
        "bindStart step",
        "bindStart languageModelCall",
        "asyncEnd languageModelCall",
        "asyncEnd step",
        "asyncEnd streamText",
      ]
    `);
  });

  it('traces the current embed lifecycle sequence', async () => {
    const sequence = await collectTracingChannelEventSequence(async () => {
      await embed({
        model: new MockEmbeddingModelV4({
          doEmbed: async () => ({
            embeddings: [[0.1, 0.2, 0.3]],
            usage: { tokens: 10 },
            warnings: [],
          }),
        }),
        value: 'sunny day at the beach',
        telemetry: {
          functionId: 'tracing-channel-embed-test',
        },
      });
    });

    expect(sequence).toMatchInlineSnapshot(`
      [
        "bindStart embed",
        "asyncEnd embed",
      ]
    `);
  });

  it('traces the current embedMany lifecycle sequence', async () => {
    const sequence = await collectTracingChannelEventSequence(async () => {
      await embedMany({
        model: new MockEmbeddingModelV4({
          maxEmbeddingsPerCall: 2,
          doEmbed: async ({ values }) => ({
            embeddings: values.map(() => [0.1, 0.2, 0.3]),
            usage: { tokens: 10 },
            warnings: [],
          }),
        }),
        values: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        telemetry: {
          functionId: 'tracing-channel-embed-many-test',
        },
      });
    });

    expect(sequence).toMatchInlineSnapshot(`
      [
        "bindStart embedMany",
        "asyncEnd embedMany",
      ]
    `);
  });

  it('traces the current rerank lifecycle sequence', async () => {
    const sequence = await collectTracingChannelEventSequence(async () => {
      await rerank({
        model: new MockRerankingModelV4({
          doRerank: async () => ({
            ranking: [
              { index: 2, relevanceScore: 0.9 },
              { index: 0, relevanceScore: 0.8 },
            ],
            warnings: [],
          }),
        }),
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'weather',
        telemetry: {
          functionId: 'tracing-channel-rerank-test',
        },
      });
    });

    expect(sequence).toMatchInlineSnapshot(`
      [
        "bindStart rerank",
        "asyncEnd rerank",
      ]
    `);
  });

  it('publishes the embed result on asyncEnd', async () => {
    const messages = await collectTracingChannelAsyncEndMessages(async () => {
      await embed({
        model: new MockEmbeddingModelV4({
          doEmbed: async () => ({
            embeddings: [[0.1, 0.2, 0.3]],
            usage: { tokens: 10 },
            warnings: [],
          }),
        }),
        value: 'sunny day at the beach',
        telemetry: {
          functionId: 'tracing-channel-embed-result-test',
        },
      });
    });

    const embedMessage = messages.find(message => message.type === 'embed');

    expect(embedMessage?.result).toMatchObject({
      value: 'sunny day at the beach',
      embedding: [0.1, 0.2, 0.3],
      usage: { tokens: 10 },
      warnings: [],
    });
  });

  it('publishes the embedMany result on asyncEnd', async () => {
    const messages = await collectTracingChannelAsyncEndMessages(async () => {
      await embedMany({
        model: new MockEmbeddingModelV4({
          maxEmbeddingsPerCall: 2,
          doEmbed: async ({ values }) => ({
            embeddings: values.map(() => [0.1, 0.2, 0.3]),
            usage: { tokens: 10 },
            warnings: [],
          }),
        }),
        values: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        telemetry: {
          functionId: 'tracing-channel-embed-many-result-test',
        },
      });
    });

    const embedManyMessage = messages.find(
      message => message.type === 'embedMany',
    );

    expect(embedManyMessage?.result).toMatchObject({
      values: [
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ],
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.3],
      ],
      usage: { tokens: 20 },
    });
  });

  it('publishes the rerank result on asyncEnd', async () => {
    const messages = await collectTracingChannelAsyncEndMessages(async () => {
      await rerank({
        model: new MockRerankingModelV4({
          doRerank: async () => ({
            ranking: [
              { index: 2, relevanceScore: 0.9 },
              { index: 0, relevanceScore: 0.8 },
            ],
            warnings: [],
          }),
        }),
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'weather',
        telemetry: {
          functionId: 'tracing-channel-rerank-result-test',
        },
      });
    });

    const rerankMessage = messages.find(message => message.type === 'rerank');

    expect(rerankMessage?.result).toMatchObject({
      originalDocuments: [
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ],
      ranking: [
        {
          originalIndex: 2,
          score: 0.9,
          document: 'cloudy day in the mountains',
        },
        {
          originalIndex: 0,
          score: 0.8,
          document: 'sunny day at the beach',
        },
      ],
    });
  });

  it('preserves streamText tracing-channel parentage with a tool call', async () => {
    let responseCount = 0;

    const parentage = await collectTracingChannelParentage(async () => {
      const result = streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'tool-call',
                      toolCallId: 'weather-tool-call',
                      toolName: 'weather',
                      input: JSON.stringify({ city: 'San Francisco' }),
                    },
                    {
                      type: 'finish',
                      finishReason: { unified: 'tool-calls', raw: undefined },
                      usage: {
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
                      },
                    },
                  ]),
                };

              case 1:
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'It is sunny.' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: { unified: 'stop', raw: 'stop' },
                      usage: {
                        inputTokens: {
                          total: 5,
                          noCache: 5,
                          cacheRead: undefined,
                          cacheWrite: undefined,
                        },
                        outputTokens: {
                          total: 7,
                          text: 7,
                          reasoning: undefined,
                        },
                      },
                    },
                  ]),
                };

              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        prompt: 'What is the weather in San Francisco?',
        stopWhen: isStepCount(3),
        tools: {
          weather: tool({
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }) => `Weather in ${city}: sunny`,
          }),
        },
        telemetry: {
          functionId: 'tracing-channel-stream-text-parentage-test',
        },
      });

      await result.consumeStream();
    });

    expect(parentage).toMatchInlineSnapshot(`
      [
        "streamText parent undefined",
        "step parent streamText",
        "languageModelCall parent step",
        "executeTool parent step",
        "step parent streamText",
        "languageModelCall parent step",
      ]
    `);
  });

  it('preserves streamText abort behavior with a tracing-channel subscriber', async () => {
    const abortController = new AbortController();
    const onAbortEvents: unknown[] = [];
    const onErrorEvents: unknown[] = [];
    let pullCount = 0;

    await collectTracingChannelEventSequence(async () => {
      const result = streamText({
        abortSignal: abortController.signal,
        model: new MockLanguageModelV4({
          doStream: async () => ({
            stream: new ReadableStream({
              pull(controller) {
                switch (pullCount++) {
                  case 0:
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    break;
                  case 1:
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
        onAbort: event => {
          onAbortEvents.push(event);
        },
        onError: error => {
          onErrorEvents.push(error);
        },
        telemetry: {
          functionId: 'tracing-channel-stream-text-abort-test',
        },
      });

      await result.consumeStream();
    });

    expect(onAbortEvents).toHaveLength(1);
    expect(onErrorEvents).toEqual([]);
  });
});
