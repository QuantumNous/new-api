import {
  JSONParseError,
  TypeValidationError,
  type SharedV4Warning,
  type LanguageModelV4StreamPart,
  type LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { jsonSchema } from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import assert, { fail } from 'node:assert';
import { afterEach, beforeEach, describe, expect, it, vitest } from 'vitest';
import { z } from 'zod/v4';
import { NoObjectGeneratedError } from '../error/no-object-generated-error';
import { verifyNoObjectGeneratedError } from '../error/verify-no-object-generated-error';
import * as logWarningsModule from '../logger/log-warnings';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { createMockServerResponse } from '../test/mock-server-response';
import type { AsyncIterableStream } from '../util/async-iterable-stream';
import { streamObject } from './stream-object';
import type { StreamObjectResult } from './stream-object-result';
import { asLanguageModelUsage } from '../types/usage';

const testUsage: LanguageModelV4Usage = {
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
function createTestModel({
  warnings = [],
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start',
      warnings,
    },
    {
      type: 'response-metadata',
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-start', id: '1' },
    { type: 'text-delta', id: '1', delta: '{ ' },
    { type: 'text-delta', id: '1', delta: '"content": ' },
    { type: 'text-delta', id: '1', delta: `"Hello, ` },
    { type: 'text-delta', id: '1', delta: `world` },
    { type: 'text-delta', id: '1', delta: `!"` },
    { type: 'text-delta', id: '1', delta: ' }' },
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: testUsage,
      providerMetadata: {
        testProvider: {
          testKey: 'testValue',
        },
      },
    },
  ]),
  request = undefined,
  response = undefined,
}: {
  stream?: ReadableStream<LanguageModelV4StreamPart>;
  request?: { body: string };
  response?: { headers: Record<string, string> };
  warnings?: SharedV4Warning[];
} = {}) {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream, request, response, warnings }),
  });
}

describe('streamObject', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningsSpy.mockRestore();
  });
  describe('output = "object"', () => {
    describe('result.objectStream', () => {
      it('should send object deltas', async () => {
        const mockModel = createTestModel();

        const result = streamObject({
          model: mockModel,
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream))
          .toMatchInlineSnapshot(`
          [
            {},
            {
              "content": "Hello, ",
            },
            {
              "content": "Hello, world",
            },
            {
              "content": "Hello, world!",
            },
          ]
        `);

        expect(mockModel.doStreamCalls[0].responseFormat)
          .toMatchInlineSnapshot(`
          {
            "description": undefined,
            "name": undefined,
            "schema": {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "additionalProperties": false,
              "properties": {
                "content": {
                  "type": "string",
                },
              },
              "required": [
                "content",
              ],
              "type": "object",
            },
            "type": "json",
          }
        `);
      });

      it('should use name and description', async () => {
        const model = createTestModel();

        const result = streamObject({
          model,
          schema: z.object({ content: z.string() }),
          schemaName: 'test-name',
          schemaDescription: 'test description',
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream))
          .toMatchInlineSnapshot(`
          [
            {},
            {
              "content": "Hello, ",
            },
            {
              "content": "Hello, world",
            },
            {
              "content": "Hello, world!",
            },
          ]
        `);
        expect(model.doStreamCalls[0].prompt).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "prompt",
                  "type": "text",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
        expect(model.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
          {
            "description": "test description",
            "name": "test-name",
            "schema": {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "additionalProperties": false,
              "properties": {
                "content": {
                  "type": "string",
                },
              },
              "required": [
                "content",
              ],
              "type": "object",
            },
            "type": "json",
          }
        `);
      });

      it('should suppress error in partialObjectStream', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => {
              throw new Error('test error');
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onError: () => {},
        });

        expect(
          await convertAsyncIterableToArray(result.partialObjectStream),
        ).toStrictEqual([]);
      });

      it('should invoke onError callback with Error', async () => {
        const result: Array<{ error: unknown }> = [];

        const resultObject = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => {
              throw new Error('test error');
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onError(event) {
            result.push(event);
          },
        });

        // consume stream
        await convertAsyncIterableToArray(resultObject.partialObjectStream);

        expect(result).toStrictEqual([{ error: new Error('test error') }]);
      });
    });

    describe('result.fullStream', () => {
      it('should send full stream data', async () => {
        const result = streamObject({
          model: createTestModel(),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        expect(
          await convertAsyncIterableToArray(result.fullStream),
        ).toMatchSnapshot();
      });
    });

    describe('result.textStream', () => {
      it('should send text stream', async () => {
        const result = streamObject({
          model: createTestModel(),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.textStream),
          ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
        );
      });
    });

    describe('result.toTextStreamResponse', () => {
      it('should create a Response with a text stream', async () => {
        const result = streamObject({
          model: createTestModel(),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        const response = result.toTextStreamResponse();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(
          response.headers.get('Content-Type'),
          'text/plain; charset=utf-8',
        );

        assert.deepStrictEqual(
          await convertReadableStreamToArray(
            response.body!.pipeThrough(new TextDecoderStream()),
          ),
          ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
        );
      });
    });

    describe('result.pipeTextStreamToResponse', async () => {
      it('should write text deltas to a Node.js response-like object', async () => {
        const mockResponse = createMockServerResponse();

        const result = streamObject({
          model: createTestModel(),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        result.pipeTextStreamToResponse(mockResponse);

        await mockResponse.waitForEnd();

        expect(mockResponse.statusCode).toBe(200);
        expect(mockResponse.headers).toMatchInlineSnapshot(`
          {
            "content-type": "text/plain; charset=utf-8",
          }
        `);
        expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
          [
            "{ ",
            ""content": "Hello, ",
            "world",
            "!"",
            " }",
          ]
        `);
      });
    });

    describe('result.usage', () => {
      it('should resolve with token usage', async () => {
        const result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              {
                type: 'text-delta',
                id: '1',
                delta: '{ "content": "Hello, world!" }',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.usage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 3,
            },
            "inputTokens": 3,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 10,
            },
            "outputTokens": 10,
            "raw": undefined,
            "totalTokens": 13,
          }
        `);
      });
    });

    describe('result.providerMetadata', () => {
      it('should resolve with provider metadata', async () => {
        const result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              {
                type: 'text-delta',
                id: '1',
                delta: '{ "content": "Hello, world!" }',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.providerMetadata).toStrictEqual({
          testProvider: { testKey: 'testValue' },
        });
      });
    });

    describe('result.response', () => {
      it('should resolve with response information', async () => {
        const result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              {
                type: 'text-delta',
                id: '1',
                delta: '{"content": "Hello, world!"}',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
            response: { headers: { call: '2' } },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.response).toStrictEqual({
          id: 'id-0',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
          headers: { call: '2' },
        });
      });
    });

    describe('result.request', () => {
      it('should contain request information', async () => {
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
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{"content": "Hello, world!"}',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
              request: { body: 'test body' },
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.request).toStrictEqual({
          body: 'test body',
        });
      });
    });

    describe('result.object', () => {
      it('should resolve with typed object', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: `"Hello, ` },
                { type: 'text-delta', id: '1', delta: `world` },
                { type: 'text-delta', id: '1', delta: `!"` },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        assert.deepStrictEqual(await result.object, {
          content: 'Hello, world!',
        });
      });

      it('should reject object promise when the streamed object does not match the schema', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"invalid": ' },
                { type: 'text-delta', id: '1', delta: `"Hello, ` },
                { type: 'text-delta', id: '1', delta: `world` },
                { type: 'text-delta', id: '1', delta: `!"` },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        await expect(result.object).rejects.toThrow(NoObjectGeneratedError);
      });

      it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"invalid": ' },
                { type: 'text-delta', id: '1', delta: `"Hello, ` },
                { type: 'text-delta', id: '1', delta: `world` },
                { type: 'text-delta', id: '1', delta: `!"` },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        // unhandled promise rejection should not be thrown (Vitest does this automatically)
      });
    });

    describe('result.finishReason', () => {
      it('should resolve with finish reason', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: `"Hello, ` },
                { type: 'text-delta', id: '1', delta: `world` },
                { type: 'text-delta', id: '1', delta: `!"` },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        // consume stream (runs in parallel)
        convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.finishReason).toStrictEqual('stop');
      });
    });

    describe('options.onFinish', () => {
      it('should be called when a valid object is generated', async () => {
        let result: Parameters<
          Required<Parameters<typeof streamObject>[0]>['onFinish']
        >[0];

        const { partialObjectStream } = streamObject({
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
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
          _internal: {
            generateId: () => 'test-id',
          },
        });

        // consume stream
        await convertAsyncIterableToArray(partialObjectStream);

        expect(result!).toMatchSnapshot();
      });

      it("should be called when object doesn't match the schema", async () => {
        let result: Parameters<
          Required<Parameters<typeof streamObject>[0]>['onFinish']
        >[0];

        const { partialObjectStream, object } = streamObject({
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
                { type: 'text-delta', id: '1', delta: '"invalid": ' },
                { type: 'text-delta', id: '1', delta: `"Hello, ` },
                { type: 'text-delta', id: '1', delta: `world` },
                { type: 'text-delta', id: '1', delta: `!"` },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
          _internal: {
            generateId: () => 'test-id',
          },
        });

        // consume stream
        await convertAsyncIterableToArray(partialObjectStream);

        // consume expected error rejection
        await object.catch(() => {});

        expect(result!).toMatchSnapshot();
      });
    });

    describe('options.headers', () => {
      it('should pass headers to model', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async ({ headers }) => {
              expect(headers).toStrictEqual({
                'custom-request-header': 'request-header-value',
              });

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: `{ "content": "headers test" }`,
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          headers: { 'custom-request-header': 'request-header-value' },
        });

        expect(
          await convertAsyncIterableToArray(result.partialObjectStream),
        ).toStrictEqual([{ content: 'headers test' }]);
      });
    });

    describe('options.providerOptions', () => {
      it('should pass provider options to model', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async ({ providerOptions }) => {
              expect(providerOptions).toStrictEqual({
                aProvider: { someKey: 'someValue' },
              });

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: `{ "content": "provider metadata test" }`,
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          providerOptions: {
            aProvider: { someKey: 'someValue' },
          },
        });

        expect(
          await convertAsyncIterableToArray(result.partialObjectStream),
        ).toStrictEqual([{ content: 'provider metadata test' }]);
      });
    });

    describe('custom schema', () => {
      it('should send object deltas', async () => {
        const mockModel = createTestModel();

        const result = streamObject({
          model: mockModel,
          schema: jsonSchema({
            type: 'object',
            properties: { content: { type: 'string' } },
            required: ['content'],
            additionalProperties: false,
          }),
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream))
          .toMatchInlineSnapshot(`
          [
            {},
            {
              "content": "Hello, ",
            },
            {
              "content": "Hello, world",
            },
            {
              "content": "Hello, world!",
            },
          ]
        `);

        expect(mockModel.doStreamCalls[0].responseFormat)
          .toMatchInlineSnapshot(`
          {
            "description": undefined,
            "name": undefined,
            "schema": {
              "additionalProperties": false,
              "properties": {
                "content": {
                  "type": "string",
                },
              },
              "required": [
                "content",
              ],
              "type": "object",
            },
            "type": "json",
          }
        `);
      });
    });

    describe('error handling', () => {
      it('should throw NoObjectGeneratedError when schema validation fails', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ "content": 123 }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  timestamp: new Date(123),
                  modelId: 'model-1',
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        try {
          await convertAsyncIterableToArray(result.partialObjectStream);
          await result.object;
          fail('must throw error');
        } catch (error) {
          verifyNoObjectGeneratedError(error, {
            message: 'No object generated: response did not match schema.',
            response: {
              id: 'id-1',
              timestamp: new Date(123),
              modelId: 'model-1',
            },
            usage: asLanguageModelUsage(testUsage),
            finishReason: 'stop',
          });
        }
      });

      it('should throw NoObjectGeneratedError when parsing fails', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{ broken json' },
                { type: 'text-end', id: '1' },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  timestamp: new Date(123),
                  modelId: 'model-1',
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        try {
          await convertAsyncIterableToArray(result.partialObjectStream);
          await result.object;
          fail('must throw error');
        } catch (error) {
          verifyNoObjectGeneratedError(error, {
            message: 'No object generated: could not parse the response.',
            response: {
              id: 'id-1',
              timestamp: new Date(123),
              modelId: 'model-1',
            },
            usage: asLanguageModelUsage(testUsage),
            finishReason: 'stop',
          });
        }
      });

      it('should throw NoObjectGeneratedError when no text is generated', async () => {
        const result = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  timestamp: new Date(123),
                  modelId: 'model-1',
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
        });

        try {
          await convertAsyncIterableToArray(result.partialObjectStream);
          await result.object;
          fail('must throw error');
        } catch (error) {
          verifyNoObjectGeneratedError(error, {
            message: 'No object generated: could not parse the response.',
            response: {
              id: 'id-1',
              timestamp: new Date(123),
              modelId: 'model-1',
            },
            usage: asLanguageModelUsage(testUsage),
            finishReason: 'stop',
          });
        }
      });
    });
  });

  describe('output = "array"', () => {
    describe('array with 3 elements', () => {
      let result: StreamObjectResult<
        { content: string }[],
        { content: string }[],
        AsyncIterableStream<{ content: string }>
      >;

      let onFinishResult: Parameters<
        Required<Parameters<typeof streamObject>[0]>['onFinish']
      >[0];

      beforeEach(async () => {
        result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{"elements":[' },
              // first element:
              { type: 'text-delta', id: '1', delta: '{' },
              { type: 'text-delta', id: '1', delta: '"content":' },
              { type: 'text-delta', id: '1', delta: `"element 1"` },
              { type: 'text-delta', id: '1', delta: '},' },
              // second element:
              { type: 'text-delta', id: '1', delta: '{ ' },
              { type: 'text-delta', id: '1', delta: '"content": ' },
              { type: 'text-delta', id: '1', delta: `"element 2"` },
              { type: 'text-delta', id: '1', delta: '},' },
              // third element:
              { type: 'text-delta', id: '1', delta: '{' },
              { type: 'text-delta', id: '1', delta: '"content":' },
              { type: 'text-delta', id: '1', delta: `"element 3"` },
              { type: 'text-delta', id: '1', delta: '}' },
              // end of array
              { type: 'text-delta', id: '1', delta: ']' },
              { type: 'text-delta', id: '1', delta: '}' },
              { type: 'text-end', id: '1' },
              // finish
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          schema: z.object({ content: z.string() }),
          output: 'array',
          prompt: 'prompt',
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
        });
      });

      it('should stream only complete objects in partialObjectStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.partialObjectStream),
          [
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
            [
              { content: 'element 1' },
              { content: 'element 2' },
              { content: 'element 3' },
            ],
          ],
        );
      });

      it('should stream only complete objects in textStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.textStream),
          [
            '[',
            '{"content":"element 1"}',
            ',{"content":"element 2"}',
            ',{"content":"element 3"}]',
          ],
        );
      });

      it('should have the correct object result', async () => {
        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.object).toStrictEqual([
          { content: 'element 1' },
          { content: 'element 2' },
          { content: 'element 3' },
        ]);
      });

      it('should call onFinish callback with full array', async () => {
        expect(onFinishResult.object).toStrictEqual([
          { content: 'element 1' },
          { content: 'element 2' },
          { content: 'element 3' },
        ]);
      });

      it('should stream elements individually in elementStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.elementStream),
          [
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ],
        );
      });
    });

    describe('array with 2 elements streamed in 1 chunk', () => {
      let result: StreamObjectResult<
        { content: string }[],
        { content: string }[],
        AsyncIterableStream<{ content: string }>
      >;

      let onFinishResult: Parameters<
        Required<Parameters<typeof streamObject>[0]>['onFinish']
      >[0];

      beforeEach(async () => {
        result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
              {
                type: 'text-start',
                id: '1',
              },
              {
                type: 'text-delta',
                id: '1',
                delta:
                  '{"elements":[{"content":"element 1"},{"content":"element 2"}]}',
              },
              {
                type: 'text-end',
                id: '1',
              },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
          schema: z.object({ content: z.string() }),
          output: 'array',
          prompt: 'prompt',
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
        });
      });

      it('should stream only complete objects in partialObjectStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.partialObjectStream),
          [[{ content: 'element 1' }, { content: 'element 2' }]],
        );
      });

      it('should stream only complete objects in textStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.textStream),
          ['[{"content":"element 1"},{"content":"element 2"}]'],
        );
      });

      it('should have the correct object result', async () => {
        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.object).toStrictEqual([
          { content: 'element 1' },
          { content: 'element 2' },
        ]);
      });

      it('should call onFinish callback with full array', async () => {
        expect(onFinishResult.object).toStrictEqual([
          { content: 'element 1' },
          { content: 'element 2' },
        ]);
      });

      it('should stream elements individually in elementStream', async () => {
        assert.deepStrictEqual(
          await convertAsyncIterableToArray(result.elementStream),
          [{ content: 'element 1' }, { content: 'element 2' }],
        );
      });
    });
  });

  describe('output = "enum"', () => {
    it('should stream an enum value', async () => {
      const mockModel = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{ ' },
          { type: 'text-delta', id: '1', delta: '"result": ' },
          { type: 'text-delta', id: '1', delta: `"su` },
          { type: 'text-delta', id: '1', delta: `nny` },
          { type: 'text-delta', id: '1', delta: `"` },
          { type: 'text-delta', id: '1', delta: ' }' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamObject({
        model: mockModel,
        output: 'enum',
        enum: ['sunny', 'rainy', 'snowy'],
        prompt: 'prompt',
      });

      expect(await convertAsyncIterableToArray(result.partialObjectStream))
        .toMatchInlineSnapshot(`
          [
            "sunny",
          ]
        `);

      expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "description": undefined,
          "name": undefined,
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "sunny",
                  "rainy",
                  "snowy",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });

    it('should not stream incorrect values', async () => {
      const mockModel = new MockLanguageModelV4({
        doStream: {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"foo` },
            { type: 'text-delta', id: '1', delta: `bar` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: testUsage,
            },
          ]),
        },
      });

      const result = streamObject({
        model: mockModel,
        output: 'enum',
        enum: ['sunny', 'rainy', 'snowy'],
        prompt: 'prompt',
      });

      expect(
        await convertAsyncIterableToArray(result.partialObjectStream),
      ).toMatchInlineSnapshot(`[]`);
    });

    it('should handle ambiguous values', async () => {
      const mockModel = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{ ' },
          { type: 'text-delta', id: '1', delta: '"result": ' },
          { type: 'text-delta', id: '1', delta: `"foo` },
          { type: 'text-delta', id: '1', delta: `bar` },
          { type: 'text-delta', id: '1', delta: `"` },
          { type: 'text-delta', id: '1', delta: ' }' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamObject({
        model: mockModel,
        output: 'enum',
        enum: ['foobar', 'foobar2'],
        prompt: 'prompt',
      });

      expect(await convertAsyncIterableToArray(result.partialObjectStream))
        .toMatchInlineSnapshot(`
        [
          "foo",
          "foobar",
        ]
      `);
    });

    it('should handle non-ambiguous values', async () => {
      const mockModel = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{ ' },
          { type: 'text-delta', id: '1', delta: '"result": ' },
          { type: 'text-delta', id: '1', delta: `"foo` },
          { type: 'text-delta', id: '1', delta: `bar` },
          { type: 'text-delta', id: '1', delta: `"` },
          { type: 'text-delta', id: '1', delta: ' }' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamObject({
        model: mockModel,
        output: 'enum',
        enum: ['foobar', 'barfoo'],
        prompt: 'prompt',
      });

      expect(await convertAsyncIterableToArray(result.partialObjectStream))
        .toMatchInlineSnapshot(`
        [
          "foobar",
        ]
      `);
    });
  });

  describe('output = "no-schema"', () => {
    it('should send object deltas', async () => {
      const mockModel = createTestModel({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{ ' },
          { type: 'text-delta', id: '1', delta: '"content": ' },
          { type: 'text-delta', id: '1', delta: `"Hello, ` },
          { type: 'text-delta', id: '1', delta: `world` },
          { type: 'text-delta', id: '1', delta: `!"` },
          { type: 'text-delta', id: '1', delta: ' }' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
          },
        ]),
      });

      const result = streamObject({
        model: mockModel,
        output: 'no-schema',
        prompt: 'prompt',
      });

      expect(await convertAsyncIterableToArray(result.partialObjectStream))
        .toMatchInlineSnapshot(`
        [
          {},
          {
            "content": "Hello, ",
          },
          {
            "content": "Hello, world",
          },
          {
            "content": "Hello, world!",
          },
        ]
      `);

      expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "description": undefined,
          "name": undefined,
          "schema": undefined,
          "type": "json",
        }
      `);
    });
  });

  describe('options.messages', () => {
    it('should support models that use "this" context in supportedUrls', async () => {
      let supportedUrlsCalled = false;
      class MockLanguageModelWithImageSupport extends MockLanguageModelV4 {
        constructor() {
          super({
            supportedUrls: () => {
              supportedUrlsCalled = true;
              // Reference 'this' to verify context
              return this.modelId === 'mock-model-id'
                ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<
                    string,
                    RegExp[]
                  >)
                : {};
            },
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          });
        }
      }

      const model = new MockLanguageModelWithImageSupport();

      const result = streamObject({
        model,
        schema: z.object({ content: z.string() }),
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
          },
        ],
      });

      const chunks = await convertAsyncIterableToArray(result.textStream);
      expect(chunks.join('')).toBe('{ "content": "Hello, world!" }');
      expect(supportedUrlsCalled).toBe(true);
    });
  });

  describe('options.experimental_repairText', () => {
    it('should be able to repair a JSONParseError', async () => {
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
              {
                type: 'text-delta',
                id: '1',
                delta: '{ "content": "provider metadata test" ',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
        experimental_repairText: async ({ text, error }) => {
          expect(error).toBeInstanceOf(JSONParseError);
          expect(text).toStrictEqual('{ "content": "provider metadata test" ');
          return text + '}';
        },
      });

      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(await result.object).toStrictEqual({
        content: 'provider metadata test',
      });
    });

    it('should be able to repair a TypeValidationError', async () => {
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
              {
                type: 'text-delta',
                id: '1',
                delta: '{ "content-a": "provider metadata test" }',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
        experimental_repairText: async ({ text, error }) => {
          expect(error).toBeInstanceOf(TypeValidationError);
          expect(text).toStrictEqual(
            '{ "content-a": "provider metadata test" }',
          );
          return `{ "content": "provider metadata test" }`;
        },
      });

      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(await result.object).toStrictEqual({
        content: 'provider metadata test',
      });
    });

    it('should be able to handle repair that returns null', async () => {
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
              {
                type: 'text-delta',
                id: '1',
                delta: '{ "content-a": "provider metadata test" }',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
        experimental_repairText: async ({ text, error }) => {
          expect(error).toBeInstanceOf(TypeValidationError);
          expect(text).toStrictEqual(
            '{ "content-a": "provider metadata test" }',
          );
          return null;
        },
      });

      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      await expect(result.object).rejects.toThrow(
        'No object generated: response did not match schema.',
      );
    });

    it('should be able to repair JSON wrapped with markdown code blocks', async () => {
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
              {
                type: 'text-delta',
                id: '1',
                delta: '```json\n{ "content": "test message" }\n```',
              },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
        experimental_repairText: async ({ text, error }) => {
          expect(error).toBeInstanceOf(JSONParseError);
          expect(text).toStrictEqual(
            '```json\n{ "content": "test message" }\n```',
          );

          // Remove markdown code block wrapper
          const cleaned = text
            .replace(/^```json\s*/, '')
            .replace(/\s*```$/, '');
          return cleaned;
        },
      });

      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(await result.object).toStrictEqual({
        content: 'test message',
      });
    });

    it('should throw NoObjectGeneratedError when parsing fails with repairText', async () => {
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
              { type: 'text-delta', id: '1', delta: '{ broken json' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          }),
        }),
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
        experimental_repairText: async ({ text }) => text + '{',
      });

      try {
        await convertAsyncIterableToArray(result.partialObjectStream);
        await result.object;
        fail('must throw error');
      } catch (error) {
        verifyNoObjectGeneratedError(error, {
          message: 'No object generated: could not parse the response.',
          response: {
            id: 'id-0',
            timestamp: new Date(0),
            modelId: 'mock-model-id',
          },
          usage: asLanguageModelUsage(testUsage),
          finishReason: 'stop',
        });
      }
    });
  });

  describe('warnings', () => {
    it('should resolve warnings promise with undefined when no warnings are present', async () => {
      const mockModel = createTestModel({
        warnings: [], // No warnings
      });

      const result = streamObject({
        model: mockModel,
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
      });

      // Consume the stream to completion
      await convertAsyncIterableToArray(result.partialObjectStream);

      // Wait for the warnings promise to resolve
      const warnings = await result.warnings;

      expect(warnings).toEqual([]);
    });

    it('should resolve warnings promise with warnings when warnings are present', async () => {
      const expectedWarnings: SharedV4Warning[] = [
        {
          type: 'unsupported',
          feature: 'frequency_penalty',
          details: 'This model does not support the frequency_penalty setting.',
        },
        {
          type: 'other',
          message: 'Test warning message',
        },
      ];

      const mockModel = createTestModel({
        warnings: expectedWarnings,
      });

      const result = streamObject({
        model: mockModel,
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
      });

      // Consume the stream to completion
      await convertAsyncIterableToArray(result.partialObjectStream);

      // Wait for the warnings promise to resolve
      const warnings = await result.warnings;

      expect(warnings).toEqual(expectedWarnings);
    });

    it('should call logWarnings with the correct warnings', async () => {
      const expectedWarnings: SharedV4Warning[] = [
        {
          type: 'other',
          message: 'Setting is not supported',
        },
        {
          type: 'unsupported',
          feature: 'temperature',
          details: 'Temperature parameter not supported',
        },
      ];

      const mockModel = createTestModel({
        warnings: expectedWarnings,
      });

      const result = streamObject({
        model: mockModel,
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
      });

      // Consume the stream to completion
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: expectedWarnings,
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });

    it('should call logWarnings with empty array when no warnings are present', async () => {
      const mockModel = createTestModel({
        warnings: [], // no warnings
      });

      const result = streamObject({
        model: mockModel,
        schema: z.object({ content: z.string() }),
        prompt: 'prompt',
      });

      // Consume the stream to completion
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: [],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });
  });

  describe('callbacks', () => {
    describe('onStart', () => {
      it('should call onStart before the model call', async () => {
        const events: string[] = [];

        const model = new MockLanguageModelV4({
          doStream: async () => {
            events.push('doStream');
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        });

        const { partialObjectStream } = streamObject({
          model,
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStart: () => {
            events.push('onStart');
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(events).toEqual(['onStart', 'doStream']);
      });

      it('should send correct information with text prompt', async () => {
        let startEvent: any;

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            provider: 'test-provider',
            modelId: 'test-model',
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          schemaName: 'test-schema',
          schemaDescription: 'A test schema',
          prompt: 'test-prompt',
          temperature: 0.5,
          maxOutputTokens: 100,
          telemetry: {
            functionId: 'test-function',
          },
          onStart: event => {
            startEvent = event;
          },
          _internal: {
            generateId: () => 'test-call-id',
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(startEvent).toMatchSnapshot();
      });

      it('should accept deprecated experimental_telemetry as an alias for telemetry', async () => {
        let startEvent: any;

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'deprecated-fn',
          },
          onStart: event => {
            startEvent = event;
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(startEvent).not.toHaveProperty('isEnabled');
        expect(startEvent).not.toHaveProperty('functionId');
      });
    });

    describe('onStepStart', () => {
      it('should call onStepStart before the model call', async () => {
        const events: string[] = [];

        const model = new MockLanguageModelV4({
          doStream: async () => {
            events.push('doStream');
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            };
          },
        });

        const { partialObjectStream } = streamObject({
          model,
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStepStart: () => {
            events.push('onStepStart');
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(events).toEqual(['onStepStart', 'doStream']);
      });

      it('should provide stepNumber 0 and model info', async () => {
        let stepStartEvent: any;

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            provider: 'test-provider',
            modelId: 'test-model',
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStepStart: event => {
            stepStartEvent = event;
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(stepStartEvent.stepNumber).toBe(0);
        expect(stepStartEvent.provider).toBe('test-provider');
        expect(stepStartEvent.modelId).toBe('test-model');
        expect(stepStartEvent.callId).toBeDefined();
        expect(stepStartEvent.promptMessages).toBeDefined();
      });
    });

    describe('onStepFinish', () => {
      it('should call onStepFinish after streaming completes', async () => {
        const events: string[] = [];

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => {
              events.push('doStream');
              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: '{ "content": "Hello, world!" }',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStepFinish: () => {
            events.push('onStepFinish');
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(events).toContain('doStream');
        expect(events).toContain('onStepFinish');
        expect(events.indexOf('doStream')).toBeLessThan(
          events.indexOf('onStepFinish'),
        );
      });

      it('should provide the raw objectText and usage', async () => {
        let stepFinishEvent: any;

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            provider: 'test-provider',
            modelId: 'test-model',
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStepFinish: event => {
            stepFinishEvent = event;
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(stepFinishEvent.stepNumber).toBe(0);
        expect(stepFinishEvent.provider).toBe('test-provider');
        expect(stepFinishEvent.modelId).toBe('test-model');
        expect(stepFinishEvent.objectText).toBe(
          '{ "content": "Hello, world!" }',
        );
        expect(stepFinishEvent.finishReason).toBe('stop');
        expect(stepFinishEvent.usage).toEqual(asLanguageModelUsage(testUsage));
        expect(stepFinishEvent.callId).toBeDefined();
      });
    });

    describe('callback ordering', () => {
      it('should fire callbacks in order: onStart -> onStepStart -> doStream -> onStepFinish -> onFinish', async () => {
        const events: string[] = [];

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => {
              events.push('doStream');
              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  {
                    type: 'text-delta',
                    id: '1',
                    delta: '{ "content": "Hello, world!" }',
                  },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: testUsage,
                  },
                ]),
              };
            },
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStart: () => {
            events.push('onStart');
          },
          onStepStart: () => {
            events.push('onStepStart');
          },
          onStepFinish: () => {
            events.push('onStepFinish');
          },
          onFinish: () => {
            events.push('onFinish');
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(events).toEqual([
          'onStart',
          'onStepStart',
          'doStream',
          'onStepFinish',
          'onFinish',
        ]);
      });

      it('should correlate all events with the same callId', async () => {
        const callIds: string[] = [];

        const { partialObjectStream } = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStart: event => {
            callIds.push(event.callId);
          },
          onStepStart: event => {
            callIds.push(event.callId);
          },
          onStepFinish: event => {
            callIds.push(event.callId);
          },
          onFinish: event => {
            callIds.push(event.callId);
          },
        });

        await convertAsyncIterableToArray(partialObjectStream);

        expect(callIds).toHaveLength(4);
        expect(new Set(callIds).size).toBe(1);
      });
    });

    describe('error handling in callbacks', () => {
      it('should not break the stream when a callback throws', async () => {
        const { partialObjectStream, object } = streamObject({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: testUsage,
                },
              ]),
            }),
          }),
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          onStart: () => {
            throw new Error('onStart error');
          },
          onStepStart: () => {
            throw new Error('onStepStart error');
          },
          onStepFinish: () => {
            throw new Error('onStepFinish error');
          },
        });

        const objects = await convertAsyncIterableToArray(partialObjectStream);
        expect(objects.length).toBeGreaterThan(0);
      });
    });
  });
});
