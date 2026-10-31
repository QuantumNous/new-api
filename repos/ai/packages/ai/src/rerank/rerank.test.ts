import type { RerankingModelV4CallOptions } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { rerank } from './rerank';
import type { RerankStartEvent, RerankEndEvent } from './rerank-events';
import type { RerankResult } from './rerank-result';
describe('rerank', () => {
  describe('rerank with string documents', () => {
    let result: RerankResult<string>;
    let calls: RerankingModelV4CallOptions[];

    beforeEach(async () => {
      calls = [];

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const model = new MockRerankingModelV4({
        doRerank: async options => {
          calls.push(options);
          return {
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
              modelId: 'mock-response-model-id',
              id: 'mock-response-id',
            },
          };
        },
      });

      result = await rerank({
        model,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        topN: 3,
        providerOptions: {
          aProvider: { someKey: 'someValue' },
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call the model with the correct options', () => {
      expect(calls).toMatchInlineSnapshot(`
        [
          {
            "abortSignal": undefined,
            "documents": {
              "type": "text",
              "values": [
                "sunny day at the beach",
                "rainy day in the city",
                "cloudy day in the mountains",
              ],
            },
            "headers": undefined,
            "providerOptions": {
              "aProvider": {
                "someKey": "someValue",
              },
            },
            "query": "rainy day",
            "topN": 3,
          },
        ]
      `);
    });

    it('should return the correct original documents', () => {
      expect(result.originalDocuments).toMatchInlineSnapshot(`
        [
          "sunny day at the beach",
          "rainy day in the city",
          "cloudy day in the mountains",
        ]
      `);
    });

    it('should return the correct reranked documents', () => {
      expect(result.rerankedDocuments).toMatchInlineSnapshot(`
        [
          "cloudy day in the mountains",
          "sunny day at the beach",
          "rainy day in the city",
        ]
      `);
    });

    it('should return the correct ranking', () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "document": "cloudy day in the mountains",
            "originalIndex": 2,
            "score": 0.9,
          },
          {
            "document": "sunny day at the beach",
            "originalIndex": 0,
            "score": 0.8,
          },
          {
            "document": "rainy day in the city",
            "originalIndex": 1,
            "score": 0.7,
          },
        ]
      `);
    });

    it('should return the correct provider metadata', () => {
      expect(result.providerMetadata).toMatchInlineSnapshot(`
        {
          "aProvider": {
            "someResponseKey": "someResponseValue",
          },
        }
      `);
    });

    it('should return the correct response', () => {
      expect(result.response).toMatchInlineSnapshot(`
        {
          "body": {
            "id": "123",
          },
          "headers": {
            "content-type": "application/json",
          },
          "id": "mock-response-id",
          "modelId": "mock-response-model-id",
          "timestamp": 2025-01-01T00:00:00.000Z,
        }
      `);
    });
  });

  describe('rerank with object documents', () => {
    let result: RerankResult<{ id: string; name: string }>;
    let calls: RerankingModelV4CallOptions[];

    beforeEach(async () => {
      calls = [];

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const model = new MockRerankingModelV4({
        doRerank: async options => {
          calls.push(options);
          return {
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
              modelId: 'mock-response-model-id',
              id: 'mock-response-id',
            },
          };
        },
      });

      result = await rerank({
        model,
        documents: [
          { id: '123', name: 'sunny day at the beach' },
          { id: '456', name: 'rainy day in the city' },
          { id: '789', name: 'cloudy day in the mountains' },
        ],
        query: 'rainy day',
        topN: 3,
        providerOptions: {
          aProvider: { someKey: 'someValue' },
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call the model with the correct options', () => {
      expect(calls).toMatchInlineSnapshot(`
        [
          {
            "abortSignal": undefined,
            "documents": {
              "type": "object",
              "values": [
                {
                  "id": "123",
                  "name": "sunny day at the beach",
                },
                {
                  "id": "456",
                  "name": "rainy day in the city",
                },
                {
                  "id": "789",
                  "name": "cloudy day in the mountains",
                },
              ],
            },
            "headers": undefined,
            "providerOptions": {
              "aProvider": {
                "someKey": "someValue",
              },
            },
            "query": "rainy day",
            "topN": 3,
          },
        ]
      `);
    });

    it('should return the correct original documents', () => {
      expect(result.originalDocuments).toMatchInlineSnapshot(`
        [
          {
            "id": "123",
            "name": "sunny day at the beach",
          },
          {
            "id": "456",
            "name": "rainy day in the city",
          },
          {
            "id": "789",
            "name": "cloudy day in the mountains",
          },
        ]
      `);
    });

    it('should return the correct reranked documents', () => {
      expect(result.rerankedDocuments).toMatchInlineSnapshot(`
        [
          {
            "id": "789",
            "name": "cloudy day in the mountains",
          },
          {
            "id": "123",
            "name": "sunny day at the beach",
          },
          {
            "id": "456",
            "name": "rainy day in the city",
          },
        ]
      `);
    });

    it('should return the correct ranking', () => {
      expect(result.ranking).toMatchInlineSnapshot(`
        [
          {
            "document": {
              "id": "789",
              "name": "cloudy day in the mountains",
            },
            "originalIndex": 2,
            "score": 0.9,
          },
          {
            "document": {
              "id": "123",
              "name": "sunny day at the beach",
            },
            "originalIndex": 0,
            "score": 0.8,
          },
          {
            "document": {
              "id": "456",
              "name": "rainy day in the city",
            },
            "originalIndex": 1,
            "score": 0.7,
          },
        ]
      `);
    });

    it('should return the correct provider metadata', () => {
      expect(result.providerMetadata).toMatchInlineSnapshot(`
        {
          "aProvider": {
            "someResponseKey": "someResponseValue",
          },
        }
      `);
    });

    it('should return the correct response', () => {
      expect(result.response).toMatchInlineSnapshot(`
        {
          "body": {
            "id": "123",
          },
          "headers": {
            "content-type": "application/json",
          },
          "id": "mock-response-id",
          "modelId": "mock-response-model-id",
          "timestamp": 2025-01-01T00:00:00.000Z,
        }
      `);
    });
  });

  describe('options.onStart', () => {
    const mockModel = new MockRerankingModelV4({
      doRerank: async () => ({
        ranking: [
          { index: 2, relevanceScore: 0.9 },
          { index: 0, relevanceScore: 0.8 },
          { index: 1, relevanceScore: 0.7 },
        ],
        response: {
          headers: { 'content-type': 'application/json' },
          body: { id: '123' },
          modelId: 'mock-response-model-id',
          id: 'mock-response-id',
        },
      }),
    });

    it('should send correct event information', async () => {
      let startEvent!: RerankStartEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        topN: 3,
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
      let startEvent!: RerankStartEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        telemetry: {
          isEnabled: true,
          recordInputs: false,
          recordOutputs: true,
          functionId: 'rerank-fn',
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
      let startEvent!: RerankStartEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: false,
          recordOutputs: true,
          functionId: 'rerank-fn-deprecated',
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
      let startEvent!: RerankStartEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent.provider).toBe('mock-provider');
      expect(startEvent.modelId).toBe('mock-model-id');
      expect(startEvent.operationId).toBe('ai.rerank');
    });

    it('should be called before doRerank', async () => {
      const callOrder: string[] = [];

      await rerank({
        model: new MockRerankingModelV4({
          doRerank: async () => {
            callOrder.push('doRerank');
            return {
              ranking: [{ index: 0, relevanceScore: 0.9 }],
            };
          },
        }),
        documents: ['test document'],
        query: 'test query',
        onStart: async () => {
          callOrder.push('onStart');
        },
      });

      expect(callOrder).toEqual(['onStart', 'doRerank']);
    });

    it('should not break reranking when callback throws', async () => {
      const result = await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onStart: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.ranking).toHaveLength(3);
      expect(result.ranking[0].score).toBe(0.9);
    });

    it('should include providerOptions, headers, documents, and query', async () => {
      let startEvent!: RerankStartEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        topN: 2,
        headers: { 'x-custom': 'header-value' },
        providerOptions: { myProvider: { key: 'value' } },
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent.headers).toEqual({ 'x-custom': 'header-value' });
      expect(startEvent.providerOptions).toEqual({
        myProvider: { key: 'value' },
      });
      expect(startEvent.documents).toEqual([
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ]);
      expect(startEvent.query).toBe('rainy day');
      expect(startEvent.topN).toBe(2);
    });
  });

  describe('options.onEnd', () => {
    let logWarningsSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logWarningsSpy = vi
        .spyOn(logWarningsModule, 'logWarnings')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      logWarningsSpy.mockRestore();
    });

    const mockModel = new MockRerankingModelV4({
      doRerank: async () => ({
        ranking: [
          { index: 2, relevanceScore: 0.9 },
          { index: 0, relevanceScore: 0.8 },
          { index: 1, relevanceScore: 0.7 },
        ],
        providerMetadata: {
          aProvider: { someResponseKey: 'someResponseValue' },
        },
        warnings: [{ type: 'other' as const, message: 'test warning' }],
        response: {
          headers: { 'content-type': 'application/json' },
          body: { id: '123' },
          modelId: 'mock-response-model-id',
          id: 'mock-response-id',
          timestamp: new Date('2025-06-01T00:00:00Z'),
        },
      }),
    });

    it('should send correct event information', async () => {
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        topN: 3,
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

    it('should include ranking and documents in event', async () => {
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onEnd: async event => {
          endEvent = event;
        },
      });

      expect(endEvent.documents).toEqual([
        'sunny day at the beach',
        'rainy day in the city',
        'cloudy day in the mountains',
      ]);
      expect(endEvent.query).toBe('rainy day');
      expect(endEvent.ranking).toEqual([
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
        {
          originalIndex: 1,
          score: 0.7,
          document: 'rainy day in the city',
        },
      ]);
    });

    it('should include model information', async () => {
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onEnd: async event => {
          endEvent = event;
        },
      });

      expect(endEvent.provider).toBe('mock-provider');
      expect(endEvent.modelId).toBe('mock-model-id');
      expect(endEvent.operationId).toBe('ai.rerank');
    });

    it('should include warnings and providerMetadata', async () => {
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onEnd: async event => {
          endEvent = event;
        },
      });

      expect(endEvent.warnings).toEqual([
        { type: 'other', message: 'test warning' },
      ]);
      expect(endEvent.providerMetadata).toEqual({
        aProvider: { someResponseKey: 'someResponseValue' },
      });
    });

    it('should include response data', async () => {
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onEnd: async event => {
          endEvent = event;
        },
      });

      expect(endEvent.response).toEqual({
        id: 'mock-response-id',
        timestamp: new Date('2025-06-01T00:00:00Z'),
        modelId: 'mock-response-model-id',
        headers: { 'content-type': 'application/json' },
        body: { id: '123' },
      });
    });

    it('should be called after doRerank', async () => {
      const callOrder: string[] = [];

      await rerank({
        model: new MockRerankingModelV4({
          doRerank: async () => {
            callOrder.push('doRerank');
            return {
              ranking: [{ index: 0, relevanceScore: 0.9 }],
            };
          },
        }),
        documents: ['test document'],
        query: 'test query',
        onEnd: async () => {
          callOrder.push('onEnd');
        },
      });

      expect(callOrder).toEqual(['doRerank', 'onEnd']);
    });

    it('should not break reranking when callback throws', async () => {
      const result = await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onEnd: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.ranking).toHaveLength(3);
      expect(result.ranking[0].score).toBe(0.9);
    });
  });

  describe('options.onStart and onEnd together', () => {
    const mockModel = new MockRerankingModelV4({
      doRerank: async () => ({
        ranking: [
          { index: 2, relevanceScore: 0.9 },
          { index: 0, relevanceScore: 0.8 },
          { index: 1, relevanceScore: 0.7 },
        ],
        response: {
          headers: { 'content-type': 'application/json' },
          body: { id: '123' },
        },
      }),
    });

    it('should have consistent callId across both events', async () => {
      let startEvent!: RerankStartEvent;
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
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

    it('should call onStart before doRerank and onEnd after', async () => {
      const callOrder: string[] = [];

      await rerank({
        model: new MockRerankingModelV4({
          doRerank: async () => {
            callOrder.push('doRerank');
            return {
              ranking: [{ index: 0, relevanceScore: 0.9 }],
            };
          },
        }),
        documents: ['test document'],
        query: 'test query',
        onStart: async () => {
          callOrder.push('onStart');
        },
        onEnd: async () => {
          callOrder.push('onEnd');
        },
      });

      expect(callOrder).toEqual(['onStart', 'doRerank', 'onEnd']);
    });

    it('should still call onEnd when onStart throws', async () => {
      let endCalled = false;

      const result = await rerank({
        model: mockModel,
        documents: [
          'sunny day at the beach',
          'rainy day in the city',
          'cloudy day in the mountains',
        ],
        query: 'rainy day',
        onStart: async () => {
          throw new Error('onStart error');
        },
        onEnd: async () => {
          endCalled = true;
        },
      });

      expect(endCalled).toBe(true);
      expect(result.ranking).toHaveLength(3);
    });

    it('should fire callbacks for empty documents', async () => {
      let startEvent!: RerankStartEvent;
      let endEvent!: RerankEndEvent;

      await rerank({
        model: mockModel,
        documents: [] as string[],
        query: 'rainy day',
        _internal: {
          generateCallId: () => 'empty-call-id',
        },
        onStart: async event => {
          startEvent = event;
        },
        onEnd: async event => {
          endEvent = event;
        },
      });

      expect(startEvent.callId).toBe('empty-call-id');
      expect(startEvent.documents).toEqual([]);
      expect(endEvent.callId).toBe('empty-call-id');
      expect(endEvent.ranking).toEqual([]);
      expect(endEvent.documents).toEqual([]);
    });
  });
});
