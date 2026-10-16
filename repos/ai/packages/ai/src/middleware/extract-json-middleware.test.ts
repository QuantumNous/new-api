import type {
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';
import { generateText, streamText } from '../generate-text';
import { wrapLanguageModel } from '../middleware/wrap-language-model';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { extractJsonMiddleware } from './extract-json-middleware';

const testUsage: LanguageModelV4Usage = {
  inputTokens: {
    total: 5,
    noCache: 5,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 10,
    text: 10,
    reasoning: 0,
  },
};

type ObjectPrototypeState = {
  buffer?: unknown;
  providerMetadata?: unknown;
  text?: unknown;
};

function clearObjectPrototypeState() {
  const objectPrototype = Object.prototype as ObjectPrototypeState;
  delete objectPrototype.buffer;
  delete objectPrototype.providerMetadata;
  delete objectPrototype.text;
}

describe('extractJsonMiddleware', () => {
  describe('wrapGenerate', () => {
    it('should strip markdown json fence from text content', async () => {
      const mockModel = new MockLanguageModelV4({
        async doGenerate() {
          return {
            content: [
              {
                type: 'text',
                text: '```json\n{"value": "test"}\n```',
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          };
        },
      });

      const result = await generateText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(result.text).toBe('{"value": "test"}');
    });

    it('should strip markdown fence without json tag', async () => {
      const mockModel = new MockLanguageModelV4({
        async doGenerate() {
          return {
            content: [
              {
                type: 'text',
                text: '```\n{"value": "test"}\n```',
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          };
        },
      });

      const result = await generateText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(result.text).toBe('{"value": "test"}');
    });

    it('should leave text without fences unchanged', async () => {
      const mockModel = new MockLanguageModelV4({
        async doGenerate() {
          return {
            content: [
              {
                type: 'text',
                text: '{"value": "test"}',
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          };
        },
      });

      const result = await generateText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(result.text).toBe('{"value": "test"}');
    });

    it('should use custom transform function when provided', async () => {
      const mockModel = new MockLanguageModelV4({
        async doGenerate() {
          return {
            content: [
              {
                type: 'text',
                text: 'PREFIX{"value": "test"}SUFFIX',
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          };
        },
      });

      const result = await generateText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware({
            transform: text => text.replace('PREFIX', '').replace('SUFFIX', ''),
          }),
        }),
        prompt: 'Generate JSON',
      });

      expect(result.text).toBe('{"value": "test"}');
    });

    it('should preserve non-text content parts', async () => {
      const mockModel = new MockLanguageModelV4({
        async doGenerate() {
          return {
            content: [
              {
                type: 'text',
                text: '```json\n{"value": "test"}\n```',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: '{"foo": "bar"}',
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          };
        },
      });

      const result = await generateText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(result.text).toBe('{"value": "test"}');
      expect(result.content).toHaveLength(3);
      expect(result.content[1]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call-1',
      });
    });
  });

  describe('wrapStream', () => {
    it('should not read Object.prototype for missing text part ids', async () => {
      clearObjectPrototypeState();
      const protoKey: string = '__proto__';

      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-delta', id: protoKey, delta: '{"value": "test"}' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
        onError: () => {},
      });

      try {
        await convertAsyncIterableToArray(result.stream);

        expect(Object.hasOwn(Object.prototype, 'buffer')).toBe(false);
        expect(Object.hasOwn(Object.prototype, 'providerMetadata')).toBe(false);
        expect(Object.hasOwn(Object.prototype, 'text')).toBe(false);
      } finally {
        clearObjectPrototypeState();
      }
    });

    it('should strip markdown json fence from streamed text', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n```' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should strip markdown fence without json tag from streamed text', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```\n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n```' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should leave text without fences unchanged in stream', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should preserve leading space in final streamed suffix without fences', async () => {
      const middleware = extractJsonMiddleware();

      const wrapped = await middleware.wrapStream!({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'there' },
            { type: 'text-delta', id: 't', delta: ' altogether?' },
            { type: 'text-end', id: 't' },
          ]),
        }),
      } as any);

      const reader = wrapped.stream.getReader();
      const chunks: LanguageModelV4StreamPart[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }

      const text = chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.delta)
        .join('');

      expect(text).toBe('there altogether?');
    });

    it('should handle fence split across multiple deltas', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '`' },
              { type: 'text-delta', id: '1', delta: '``' },
              { type: 'text-delta', id: '1', delta: 'json\n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n`' },
              { type: 'text-delta', id: '1', delta: '``' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should handle content that starts with backtick but is not a fence', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '`code`' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('`code`');
    });

    it('should pass through non-text chunks unchanged', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n```' },
              { type: 'text-end', id: '1' },
              {
                type: 'tool-input-start',
                id: 'tool-1',
                toolName: 'testTool',
              },
              {
                type: 'tool-input-delta',
                id: 'tool-1',
                delta: '{"arg": "value"}',
              },
              { type: 'tool-input-end', id: 'tool-1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      const stream = await convertAsyncIterableToArray(result.stream);
      const toolInputStart = stream.find(
        chunk => chunk.type === 'tool-input-start',
      );
      expect(toolInputStart).toBeDefined();
    });

    it('should handle multiple text blocks with different IDs', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n' },
              { type: 'text-delta', id: '1', delta: '{"first": true}' },
              { type: 'text-delta', id: '1', delta: '\n```' },
              { type: 'text-end', id: '1' },
              { type: 'text-start', id: '2' },
              { type: 'text-delta', id: '2', delta: '```json\n' },
              { type: 'text-delta', id: '2', delta: '{"second": true}' },
              { type: 'text-delta', id: '2', delta: '\n```' },
              { type: 'text-end', id: '2' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      const stream = await convertAsyncIterableToArray(result.stream);
      const textDeltas = stream.filter(chunk => chunk.type === 'text-delta');

      const allText = textDeltas.map(d => d.text).join('');
      expect(allText).toContain('{"first": true}');
      expect(allText).toContain('{"second": true}');
      expect(allText).not.toContain('```');
    });

    it('should handle text-delta without prior text-start', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              // text-delta without text-start (edge case)
              { type: 'text-delta', id: 'unknown', delta: 'some text' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: testUsage,
              },
            ]),
          };
        },
      });

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      const stream = await convertAsyncIterableToArray(result.stream);
      const textDeltas = stream.filter(chunk => chunk.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit text-start when stream ends while still in prefix phase', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              // Very short content that stays in prefix buffer
              { type: 'text-delta', id: '1', delta: '``' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      const stream = await convertAsyncIterableToArray(result.stream);
      const textStarts = stream.filter(chunk => chunk.type === 'text-start');
      const textEnds = stream.filter(chunk => chunk.type === 'text-end');

      expect(textStarts.length).toBe(1);
      expect(textEnds.length).toBe(1);
    });

    it('should apply custom transform to streamed content', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'PREFIX' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: 'SUFFIX' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware({
            transform: text => text.replace('PREFIX', '').replace('SUFFIX', ''),
          }),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should handle large content exceeding suffix buffer', async () => {
      const largeJson = JSON.stringify({
        data: 'x'.repeat(100),
        nested: { values: Array.from({ length: 10 }, (_, i) => i) },
      });

      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n' },
              { type: 'text-delta', id: '1', delta: largeJson },
              { type: 'text-delta', id: '1', delta: '\n```' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe(largeJson);
    });

    it('should handle content arriving character by character', async () => {
      const chars = [...'```json\n{"value": "test"}\n```'];

      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              ...chars.map(char => ({
                type: 'text-delta' as const,
                id: '1',
                delta: char,
              })),
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should handle fence with extra whitespace', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json  \n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n```  ' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });

    it('should verify stream output matches expected structure', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n' },
              { type: 'text-delta', id: '1', delta: '{"value": "test"}' },
              { type: 'text-delta', id: '1', delta: '\n```' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      const stream = await convertAsyncIterableToArray(result.stream);

      expect(stream.find(c => c.type === 'start')).toBeDefined();
      expect(stream.find(c => c.type === 'text-start')).toBeDefined();
      expect(stream.find(c => c.type === 'text-end')).toBeDefined();
      expect(stream.find(c => c.type === 'finish')).toBeDefined();

      const textDeltas = stream.filter(c => c.type === 'text-delta');
      const combinedText = textDeltas.map(d => d.text).join('');
      expect(combinedText).toBe('{"value": "test"}');
    });

    it('should handle empty content between fences', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '```json\n```' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('');
    });

    it('should handle content starting without backtick quickly switching to streaming', async () => {
      const mockModel = new MockLanguageModelV4({
        async doStream() {
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{' },
              { type: 'text-delta', id: '1', delta: '"value": "test"' },
              { type: 'text-delta', id: '1', delta: '}' },
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

      const result = streamText({
        model: wrapLanguageModel({
          model: mockModel,
          middleware: extractJsonMiddleware(),
        }),
        prompt: 'Generate JSON',
      });

      expect(await result.text).toBe('{"value": "test"}');
    });
  });
});
