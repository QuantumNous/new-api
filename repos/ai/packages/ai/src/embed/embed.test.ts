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
import { embed } from './embed';
import type { EmbedStartEvent, EmbedEndEvent } from './embed-events';

const dummyEmbedding = [0.1, 0.2, 0.3];
const testValue = 'sunny day at the beach';

vi.mock('../version', () => {
  return {
    VERSION: '0.0.0-test',
  };
});

describe('result.embedding', () => {
  it('should generate embedding', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
    });

    assert.deepStrictEqual(result.embedding, dummyEmbedding);
  });
});

describe('result.response', () => {
  it('should include response in the result', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding], undefined, {
          body: { foo: 'bar' },
          headers: { foo: 'bar' },
        }),
      }),
      value: testValue,
    });

    expect(result.response?.body).toMatchInlineSnapshot(`
      {
        "foo": "bar",
      }
    `);
    expect(result.response?.headers).toMatchInlineSnapshot(`
      {
        "foo": "bar",
      }
    `);
  });
});

describe('result.value', () => {
  it('should include value in the result', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
    });

    assert.deepStrictEqual(result.value, testValue);
  });
});

describe('result.usage', () => {
  it('should include usage in the result', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding], { tokens: 10 }),
      }),
      value: testValue,
    });

    assert.deepStrictEqual(result.usage, { tokens: 10 });
  });
});

describe('result.providerMetadata', () => {
  it('should include provider metadata when returned by the model', async () => {
    const providerMetadata = {
      gateway: {
        routing: {
          resolvedProvider: 'test-provider',
        },
      },
    };

    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed(
          [testValue],
          [dummyEmbedding],
          undefined,
          {
            headers: {},
            body: {},
          },
          providerMetadata,
        ),
      }),
      value: testValue,
    });

    expect(result.providerMetadata).toStrictEqual(providerMetadata);
  });
});

describe('options.headers', () => {
  it('should set headers', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async ({ headers }) => {
          assert.deepStrictEqual(headers, {
            'custom-request-header': 'request-header-value',
            'user-agent': 'ai/0.0.0-test',
          });

          return { embeddings: [dummyEmbedding], warnings: [] };
        },
      }),
      value: testValue,
      headers: {
        'custom-request-header': 'request-header-value',
      },
    });

    assert.deepStrictEqual(result.embedding, dummyEmbedding);
  });
});

describe('options.providerOptions', () => {
  it('should pass provider options to model', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async ({ providerOptions }) => {
          expect(providerOptions).toStrictEqual({
            aProvider: { someKey: 'someValue' },
          });

          return { embeddings: [[1, 2, 3]], warnings: [] };
        },
      }),
      value: 'test-input',
      providerOptions: {
        aProvider: { someKey: 'someValue' },
      },
    });

    expect(result.embedding).toStrictEqual([1, 2, 3]);
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

  it('should include warnings in the result', async () => {
    const expectedWarnings: Warning[] = [
      {
        type: 'other',
        message: 'Setting is not supported',
      },
      {
        type: 'unsupported',
        feature: 'dimensions',
        details: 'Dimensions parameter not supported',
      },
    ];

    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async () => ({
          embeddings: [dummyEmbedding],
          warnings: expectedWarnings,
        }),
      }),
      value: testValue,
    });

    expect(result.warnings).toStrictEqual(expectedWarnings);
  });

  it('should default missing v2 provider warnings to an empty array', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV2<string>({
        doEmbed: async () => ({
          embeddings: [dummyEmbedding],
          usage: { tokens: 1 },
        }),
      }),
      value: testValue,
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
    logWarningsSpy.mockRestore();
  });

  it('should call logWarnings with the correct warnings', async () => {
    const expectedWarnings: Warning[] = [
      {
        type: 'other',
        message: 'Setting is not supported',
      },
      {
        type: 'unsupported',
        feature: 'dimensions',
        details: 'Dimensions parameter not supported',
      },
    ];

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async () => ({
          embeddings: [dummyEmbedding],
          warnings: expectedWarnings,
        }),
      }),
      value: testValue,
    });

    expect(logWarningsSpy).toHaveBeenCalledOnce();
    expect(logWarningsSpy).toHaveBeenCalledWith({
      warnings: expectedWarnings,
      provider: 'mock-provider',
      model: 'mock-model-id',
    });
  });
});

describe('options.onStart', () => {
  it('should send correct event information', async () => {
    let startEvent!: EmbedStartEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
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

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: true,
        functionId: 'embed-fn',
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

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: true,
        functionId: 'embed-fn-deprecated',
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

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      onStart: async event => {
        startEvent = event;
      },
    });

    expect(startEvent.provider).toBe('mock-provider');
    expect(startEvent.modelId).toBe('mock-model-id');
    expect(startEvent.operationId).toBe('ai.embed');
  });

  it('should be called before doEmbed', async () => {
    const callOrder: string[] = [];

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: [dummyEmbedding], warnings: [] };
        },
      }),
      value: testValue,
      onStart: async () => {
        callOrder.push('onStart');
      },
    });

    expect(callOrder).toEqual(['onStart', 'doEmbed']);
  });

  it('should not break embedding when callback throws', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      onStart: async () => {
        throw new Error('callback error');
      },
    });

    assert.deepStrictEqual(result.embedding, dummyEmbedding);
  });

  it('should include providerOptions and headers', async () => {
    let startEvent!: EmbedStartEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
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
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningsSpy.mockRestore();
  });

  it('should send correct event information', async () => {
    let endEvent!: EmbedEndEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding], { tokens: 10 }),
      }),
      value: testValue,
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

  it('should include embedding and usage in event', async () => {
    let endEvent!: EmbedEndEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding], { tokens: 15 }),
      }),
      value: testValue,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.embedding).toEqual(dummyEmbedding);
    expect(endEvent.usage).toEqual({ tokens: 15 });
    expect(endEvent.value).toBe(testValue);
  });

  it('should include model information', async () => {
    let endEvent!: EmbedEndEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.provider).toBe('mock-provider');
    expect(endEvent.modelId).toBe('mock-model-id');
    expect(endEvent.operationId).toBe('ai.embed');
  });

  it('should include warnings and providerMetadata', async () => {
    let endEvent!: EmbedEndEvent;
    const expectedWarnings: Warning[] = [
      { type: 'other', message: 'test warning' },
    ];
    const providerMetadata = {
      gateway: { routing: { resolvedProvider: 'test' } },
    };

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed(
          [testValue],
          [dummyEmbedding],
          undefined,
          { headers: {}, body: {} },
          providerMetadata,
          expectedWarnings,
        ),
      }),
      value: testValue,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.providerMetadata).toEqual(providerMetadata);
    expect(endEvent.warnings).toEqual(expectedWarnings);
  });

  it('should include response data', async () => {
    let endEvent!: EmbedEndEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding], undefined, {
          headers: { 'x-resp': 'val' },
          body: { result: 'ok' },
        }),
      }),
      value: testValue,
      onEnd: async event => {
        endEvent = event;
      },
    });

    expect(endEvent.response).toEqual({
      headers: { 'x-resp': 'val' },
      body: { result: 'ok' },
    });
  });

  it('should be called after doEmbed', async () => {
    const callOrder: string[] = [];

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: [dummyEmbedding], warnings: [] };
        },
      }),
      value: testValue,
      onEnd: async () => {
        callOrder.push('onEnd');
      },
    });

    expect(callOrder).toEqual(['doEmbed', 'onEnd']);
  });

  it('should not break embedding when callback throws', async () => {
    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      onEnd: async () => {
        throw new Error('callback error');
      },
    });

    assert.deepStrictEqual(result.embedding, dummyEmbedding);
  });
});

describe('options.onStart and onEnd together', () => {
  it('should have consistent callId across both events', async () => {
    let startEvent!: EmbedStartEvent;
    let endEvent!: EmbedEndEvent;

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
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

    await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: async ({ values }) => {
          callOrder.push('doEmbed');
          return { embeddings: [dummyEmbedding], warnings: [] };
        },
      }),
      value: testValue,
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

    const result = await embed({
      model: new MockEmbeddingModelV4({
        doEmbed: mockEmbed([testValue], [dummyEmbedding]),
      }),
      value: testValue,
      onStart: async () => {
        throw new Error('start error');
      },
      onEnd: async () => {
        endCalled = true;
      },
    });

    assert.deepStrictEqual(result.embedding, dummyEmbedding);
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
  warnings: Warning[] = [],
): EmbeddingModelV4['doEmbed'] {
  return async ({ values }) => {
    assert.deepStrictEqual(expectedValues, values);
    return { embeddings, usage, response, providerMetadata, warnings };
  };
}
