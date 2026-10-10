import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import assert from 'node:assert';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  vitest,
} from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockEmbeddingModelV2 } from '../test/mock-embedding-model-v2';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import type { Embedding, EmbeddingModelUsage, Warning } from '../types';
import { createResolvablePromise } from '../util/create-resolvable-promise';
import { embedMany } from './embed-many';
import type { EmbedStartEvent, EmbedEndEvent } from './embed-events';

vi.mock('../version', () => {
  return {
    VERSION: '0.0.0-test',
  };
});

const dummyEmbeddings = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
  [0.7, 0.8, 0.9],
];

const testValues = [
  'sunny day at the beach',
  'rainy afternoon in the city',
  'snowy night in the mountains',
];

describe('model.supportsParallelCalls', () => {
  it('should not parallelize when false', async () => {
    const events: string[] = [];
    let callCount = 0;

    const resolvables = [
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
    ];

    const embedManyPromise = embedMany({
      model: new MockEmbeddingModelV4({
        supportsParallelCalls: false,
        maxEmbeddingsPerCall: 1,
        doEmbed: async () => {
          const index = callCount++;
          events.push(`start-${index}`);

          await resolvables[index].promise;
          events.push(`end-${index}`);

          return {
            embeddings: [dummyEmbeddings[index]],
            response: { headers: {}, body: {} },
            warnings: [],
          };
        },
      }),
      values: testValues,
    });

    resolvables.forEach(resolvable => {
      resolvable.resolve();
    });

    const { embeddings } = await embedManyPromise;

    expect(events).toStrictEqual([
      'start-0',
      'end-0',
      'start-1',
      'end-1',
      'start-2',
      'end-2',
    ]);

    expect(embeddings).toStrictEqual(dummyEmbeddings);
  });

  it('should parallelize when true', async () => {
    const events: string[] = [];
    let callCount = 0;

    const resolvables = [
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
    ];

    const embedManyPromise = embedMany({
      model: new MockEmbeddingModelV4({
        supportsParallelCalls: true,
        maxEmbeddingsPerCall: 1,
        doEmbed: async () => {
          const index = callCount++;
          events.push(`start-${index}`);

          await resolvables[index].promise;
          events.push(`end-${index}`);

          return {
            embeddings: [dummyEmbeddings[index]],
            response: { headers: {}, body: {} },
            warnings: [],
          };
        },
      }),
      values: testValues,
    });

    resolvables.forEach(resolvable => {
      resolvable.resolve();
    });

    const { embeddings } = await embedManyPromise;

    expect(events).toStrictEqual([
      'start-0',
      'start-1',
      'start-2',
      'end-0',
      'end-1',
      'end-2',
    ]);

    expect(embeddings).toStrictEqual(dummyEmbeddings);
  });

  it('should support maxParallelCalls', async () => {
    const events: string[] = [];
    let callCount = 0;

    const resolvables = [
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
      createResolvablePromise<void>(),
    ];

    const embedManyPromise = embedMany({
      maxParallelCalls: 2,
      model: new MockEmbeddingModelV4({
        supportsParallelCalls: true,
        maxEmbeddingsPerCall: 1,
        doEmbed: async () => {
          const index = callCount++;
          events.push(`start-${index}`);

          await resolvables[index].promise;
          events.push(`end-${index}`);

          return {
            embeddings: [dummyEmbeddings[index]],
            response: { headers: {}, body: {} },
            warnings: [],
          };
        },
      }),
      values: testValues,
    });

    resolvables.forEach(resolvable => {
      resolvable.resolve();
    });

    const { embeddings } = await embedManyPromise;

    expect(events).toStrictEqual([
      'start-0',
      'start-1',
      'end-0',
      'end-1',
      'start-2',
      'end-2',
    ]);

    expect(embeddings).toStrictEqual(dummyEmbeddings);
  });
});

describe('result.embedding', () => {
  it('should generate embeddings', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
  });

  it('should generate embeddings when several calls are required', async () => {
    let callCount = 0;

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async ({ values }) => {
          switch (callCount++) {
            case 0:
              assert.deepStrictEqual(values, testValues.slice(0, 2));
              return { embeddings: dummyEmbeddings.slice(0, 2), warnings: [] };
            case 1:
              assert.deepStrictEqual(values, testValues.slice(2));
              return { embeddings: dummyEmbeddings.slice(2), warnings: [] };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
  });
});

describe('result.responses', () => {
  it('should include responses in the result', async () => {
    let callCount = 0;
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 1,

        doEmbed: async ({ values }) => {
          switch (callCount++) {
            case 0:
              assert.deepStrictEqual(values, [testValues[0]]);
              return {
                embeddings: dummyEmbeddings,
                response: {
                  body: { first: true },
                },
                warnings: [],
              };
            case 1:
              assert.deepStrictEqual(values, [testValues[1]]);
              return {
                embeddings: dummyEmbeddings,
                response: {
                  body: { second: true },
                },
                warnings: [],
              };
            case 2:
              assert.deepStrictEqual(values, [testValues[2]]);
              return {
                embeddings: dummyEmbeddings,
                response: {
                  body: { third: true },
                },
                warnings: [],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    expect(result.responses).toMatchSnapshot();
  });
});

describe('result.values', () => {
  it('should include values in the result', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
    });

    assert.deepStrictEqual(result.values, testValues);
  });
});

describe('result.usage', () => {
  it('should include usage in the result', async () => {
    let callCount = 0;

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async () => {
          switch (callCount++) {
            case 0:
              return {
                embeddings: dummyEmbeddings.slice(0, 2),
                usage: { tokens: 10 },
                warnings: [],
              };
            case 1:
              return {
                embeddings: dummyEmbeddings.slice(2),
                usage: { tokens: 20 },
                warnings: [],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    assert.deepStrictEqual(result.usage, { tokens: 30 });
  });
});

describe('options.headers', () => {
  it('should set headers', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: async ({ headers }) => {
          assert.deepStrictEqual(headers, {
            'custom-request-header': 'request-header-value',
            'user-agent': 'ai/0.0.0-test',
          });

          return { embeddings: dummyEmbeddings, warnings: [] };
        },
      }),
      values: testValues,
      headers: {
        'custom-request-header': 'request-header-value',
      },
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
  });
});

describe('options.providerOptions', () => {
  it('should pass provider options to model', async () => {
    const model = new MockEmbeddingModelV4({
      doEmbed: async ({ providerOptions }) => {
        return { embeddings: [[1, 2, 3]], warnings: [] };
      },
    });

    vi.spyOn(model, 'doEmbed');

    await embedMany({
      model,
      values: ['test-input'],
      providerOptions: {
        aProvider: { someKey: 'someValue' },
      },
    });

    expect(model.doEmbed).toHaveBeenCalledWith({
      headers: {
        'user-agent': 'ai/0.0.0-test',
      },
      providerOptions: {
        aProvider: { someKey: 'someValue' },
      },
      values: ['test-input'],
    });
  });
});

describe('result.providerMetadata', () => {
  it('should include provider metadata when returned by the model', async () => {
    const providerMetadata = {
      gateway: { routing: { resolvedProvider: 'test-provider' } },
    };

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        supportsParallelCalls: false,
        maxEmbeddingsPerCall: 3,
        doEmbed: mockEmbed(
          testValues,
          dummyEmbeddings,
          undefined,
          {
            headers: {},
            body: {},
          },
          providerMetadata,
        ),
      }),
      values: testValues,
    });

    expect(result.providerMetadata).toStrictEqual(providerMetadata);
  });
});

describe('result.warnings', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningsSpy.mockRestore();
  });

  it('should include warnings in the result (single call path)', async () => {
    const expectedWarnings: Warning[] = [
      {
        type: 'other',
        message: 'Setting is not supported',
      },
    ];

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: null,
        doEmbed: async () => ({
          embeddings: dummyEmbeddings,
          warnings: expectedWarnings,
        }),
      }),
      values: testValues,
    });

    expect(result.warnings).toStrictEqual(expectedWarnings);
  });

  it('should default missing v2 provider warnings to an empty array in the single call path', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV2<string>({
        maxEmbeddingsPerCall: null,
        doEmbed: async () => ({
          embeddings: dummyEmbeddings,
          usage: { tokens: 3 },
        }),
      }),
      values: testValues,
    });

    expect(result.warnings).toStrictEqual([]);
  });

  it('should aggregate warnings from multiple calls', async () => {
    const warning1: Warning = {
      type: 'other',
      message: 'Warning from call 1',
    };
    const warning2: Warning = {
      type: 'unsupported',
      feature: 'dimensions',
    };

    let callCount = 0;

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async () => {
          switch (callCount++) {
            case 0:
              return {
                embeddings: dummyEmbeddings.slice(0, 2),
                warnings: [warning1],
              };
            case 1:
              return {
                embeddings: dummyEmbeddings.slice(2),
                warnings: [warning2],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    expect(result.warnings).toStrictEqual([warning1, warning2]);
  });

  it('should default missing v2 provider warnings to an empty array in the chunked path', async () => {
    let callCount = 0;

    const result = await embedMany({
      model: new MockEmbeddingModelV2<string>({
        maxEmbeddingsPerCall: 2,
        doEmbed: async () => {
          switch (callCount++) {
            case 0:
              return {
                embeddings: dummyEmbeddings.slice(0, 2),
                usage: { tokens: 2 },
              };
            case 1:
              return {
                embeddings: dummyEmbeddings.slice(2),
                usage: { tokens: 1 },
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    expect(result.warnings).toStrictEqual([]);
  });
});

describe('logWarnings', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call logWarnings with the correct warnings (single call path)', async () => {
    const expectedWarnings: Warning[] = [
      {
        type: 'other',
        message: 'Setting is not supported',
      },
    ];

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: null,
        doEmbed: async () => ({
          embeddings: dummyEmbeddings,
          warnings: expectedWarnings,
        }),
      }),
      values: testValues,
    });

    expect(logWarningsSpy).toHaveBeenCalledOnce();
    expect(logWarningsSpy).toHaveBeenCalledWith({
      warnings: expectedWarnings,
      provider: 'mock-provider',
      model: 'mock-model-id',
    });
  });

  it('should call logWarnings with aggregated warnings from multiple calls', async () => {
    const warning1: Warning = {
      type: 'other',
      message: 'Warning from call 1',
    };
    const warning2: Warning = {
      type: 'unsupported',
      feature: 'dimensions',
    };

    let callCount = 0;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async () => {
          switch (callCount++) {
            case 0:
              return {
                embeddings: dummyEmbeddings.slice(0, 2),
                warnings: [warning1],
              };
            case 1:
              return {
                embeddings: dummyEmbeddings.slice(2),
                warnings: [warning2],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
    });

    expect(logWarningsSpy).toHaveBeenCalledOnce();
    expect(logWarningsSpy).toHaveBeenCalledWith({
      warnings: [warning1, warning2],
      provider: 'mock-provider',
      model: 'mock-model-id',
    });
  });
});

describe('options.onStart', () => {
  it('should send correct event information', async () => {
    let startEvent!: EmbedStartEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      telemetry: {
        functionId: 'test-function',
      },
      _internal: {
        generateCallId: () => 'test-call-id',
      },
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent).toMatchSnapshot();
  });

  it('should include telemetry fields', async () => {
    let startEvent!: EmbedStartEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: true,
        functionId: 'embed-many-fn',
      },
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent).not.toHaveProperty('isEnabled');
    expect(startEvent).not.toHaveProperty('recordInputs');
    expect(startEvent).not.toHaveProperty('recordOutputs');
    expect(startEvent).not.toHaveProperty('functionId');
  });

  it('should accept deprecated experimental_telemetry as an alias for telemetry', async () => {
    let startEvent!: EmbedStartEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: true,
        functionId: 'embed-many-fn-deprecated',
      },
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent).not.toHaveProperty('isEnabled');
    expect(startEvent).not.toHaveProperty('recordInputs');
    expect(startEvent).not.toHaveProperty('recordOutputs');
    expect(startEvent).not.toHaveProperty('functionId');
  });

  it('should include model information', async () => {
    let startEvent!: EmbedStartEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent.provider).toBe('mock-provider');
    expect(startEvent.modelId).toBe('mock-model-id');
    expect(startEvent.operationId).toBe('ai.embedMany');
  });

  it('should be called before doEmbed', async () => {
    const callOrder: string[] = [];

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: dummyEmbeddings, warnings: [] };
        },
      }),
      values: testValues,
      onStart: async () => {
        callOrder.push('onStart');
      },
    });

    expect(callOrder).toEqual(['onStart', 'doEmbed']);
  });

  it('should not break embedding when callback throws', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      onStart: async () => {
        throw new Error('callback error');
      },
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
  });

  it('should include providerOptions and headers', async () => {
    let startEvent!: EmbedStartEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      headers: { 'x-custom': 'header-value' },
      providerOptions: { myProvider: { key: 'value' } },
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent.headers).toEqual({
      'x-custom': 'header-value',
      'user-agent': 'ai/0.0.0-test',
    });
    expect(startEvent.providerOptions).toEqual({
      myProvider: { key: 'value' },
    });
  });
});

describe('options.onEnd', () => {
  it('should send correct event information (single call path)', async () => {
    let endEvent!: EmbedEndEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings, { tokens: 10 }),
      }),
      values: testValues,
      telemetry: {
        functionId: 'test-function',
      },
      _internal: {
        generateCallId: () => 'test-call-id',
      },
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent).toMatchSnapshot();
  });

  it('should send correct event information (chunked path)', async () => {
    let endEvent!: EmbedEndEvent;
    let callCount = 0;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 2,
        doEmbed: async () => {
          switch (callCount++) {
            case 0:
              return {
                embeddings: dummyEmbeddings.slice(0, 2),
                usage: { tokens: 10 },
                response: { headers: {}, body: {} },
                warnings: [],
              };
            case 1:
              return {
                embeddings: dummyEmbeddings.slice(2),
                usage: { tokens: 5 },
                response: { headers: {}, body: {} },
                warnings: [],
              };
            default:
              throw new Error('Unexpected call');
          }
        },
      }),
      values: testValues,
      _internal: {
        generateCallId: () => 'test-call-id',
      },
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.callId).toBe('test-call-id');
    expect(endEvent.operationId).toBe('ai.embedMany');
    expect(endEvent.embedding).toEqual(dummyEmbeddings);
    expect(endEvent.usage).toEqual({ tokens: 15 });
    expect(endEvent.value).toEqual(testValues);
    expect(endEvent.response).toHaveLength(2);
  });

  it('should include embeddings and usage in event', async () => {
    let endEvent!: EmbedEndEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings, { tokens: 15 }),
      }),
      values: testValues,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.embedding).toEqual(dummyEmbeddings);
    expect(endEvent.usage).toEqual({ tokens: 15 });
    expect(endEvent.value).toEqual(testValues);
  });

  it('should include model information', async () => {
    let endEvent!: EmbedEndEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.provider).toBe('mock-provider');
    expect(endEvent.modelId).toBe('mock-model-id');
    expect(endEvent.operationId).toBe('ai.embedMany');
  });

  it('should include responses data', async () => {
    let endEvent!: EmbedEndEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings, undefined, {
          headers: { 'x-resp': 'val' },
          body: { result: 'ok' },
        }),
      }),
      values: testValues,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.response).toEqual([
      {
        headers: { 'x-resp': 'val' },
        body: { result: 'ok' },
      },
    ]);
  });

  it('should be called after doEmbed', async () => {
    const callOrder: string[] = [];

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: dummyEmbeddings, warnings: [] };
        },
      }),
      values: testValues,
      onEnd: async () => {
        callOrder.push('onEnd');
      },
    });

    expect(callOrder).toEqual(['doEmbed', 'onEnd']);
  });

  it('should not break embedding when callback throws', async () => {
    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      onEnd: async () => {
        throw new Error('callback error');
      },
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
  });
});

describe('options.onStart and onEnd together', () => {
  it('should have consistent callId across both events', async () => {
    let startEvent!: EmbedStartEvent;
    let endEvent!: EmbedEndEvent;

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      _internal: {
        generateCallId: () => 'consistent-call-id',
      },
      onStart: async event => {
        startEvent = event;
      },
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(startEvent.callId).toBe('consistent-call-id');
    expect(endEvent.callId).toBe('consistent-call-id');
    expect(startEvent.callId).toBe(endEvent.callId);
  });

  it('should call onStart before doEmbed and onEnd after', async () => {
    const callOrder: string[] = [];

    await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: dummyEmbeddings, warnings: [] };
        },
      }),
      values: testValues,
      onStart: async () => {
        callOrder.push('onStart');
      },
      onEnd: async () => {
        callOrder.push('onEnd');
      },
    });

    expect(callOrder).toEqual(['onStart', 'doEmbed', 'onEnd']);
  });

  it('should still call onEnd when onStart throws', async () => {
    let endCalled = false;

    const result = await embedMany({
      model: new MockEmbeddingModelV4({
        maxEmbeddingsPerCall: 5,
        doEmbed: mockEmbed(testValues, dummyEmbeddings),
      }),
      values: testValues,
      onStart: async () => {
        throw new Error('start error');
      },
      onEnd: async () => {
        endCalled = true;
      },
    });

    assert.deepStrictEqual(result.embeddings, dummyEmbeddings);
    expect(endCalled).toBe(true);
  });
});

function mockEmbed(
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
