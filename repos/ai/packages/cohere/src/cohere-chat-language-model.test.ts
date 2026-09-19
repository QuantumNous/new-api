import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import fs from 'node:fs';
import { createCohere } from './cohere-provider';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const TEST_PROMPT: LanguageModelV4Prompt = [
  {
    role: 'system',
    content: 'you are a friendly bot!',
  },
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createCohere({
  apiKey: 'test-api-key',
});
const model = provider('command-r-plus');

const server = createTestServer({
  'https://api.cohere.com/v2/chat': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.cohere.com/v2/chat'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareChunksFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  const chunks = fs
    .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      const parsed = JSON.parse(line);
      return `event: ${parsed.type}\ndata: ${line}\n\n`;
    });

  server.urls['https://api.cohere.com/v2/chat'].response = {
    type: 'stream-chunks',
    headers,
    chunks,
  };
}

function prepareChunkLinesResponse(chunks: Array<Record<string, unknown>>) {
  server.urls['https://api.cohere.com/v2/chat'].response = {
    type: 'stream-chunks',
    chunks: chunks.map(chunk => {
      const line = JSON.stringify(chunk);
      return `event: ${chunk.type}\ndata: ${line}\n\n`;
    }),
  };
}

describe('doGenerate', () => {
  describe('text', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-text');
    });

    it('should extract text response', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('max tokens', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-max-tokens');
    });

    it('should map MAX_TOKENS finish reason to length', async () => {
      const { finishReason } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(finishReason).toMatchInlineSnapshot(`
        {
          "raw": "MAX_TOKENS",
          "unified": "length",
        }
      `);
    });
  });

  describe('tool call', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-tool-call');
    });

    it('should extract tool calls', async () => {
      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            inputSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('null tool call arguments', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-null-args');
    });

    it('should handle string "null" tool call arguments', async () => {
      const { content } = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'currentTime',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the current time?' }],
          },
        ],
      });

      expect(content).toMatchSnapshot();
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-reasoning');
    });

    it('should extract reasoning from response', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('top-level reasoning', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-text');
    });

    it('should map top-level reasoning to thinking enabled with budget', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body.thinking).toBeDefined();
      expect(body.thinking.type).toBe('enabled');
      expect(body.thinking.token_budget).toBeTypeOf('number');
      expect(body.thinking.token_budget).toBeGreaterThan(0);
    });

    it('should map top-level reasoning none to thinking disabled', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body.thinking).toStrictEqual({ type: 'disabled' });
    });

    it('should prefer providerOptions over top-level reasoning', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
        providerOptions: {
          cohere: {
            thinking: { type: 'enabled' },
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body.thinking.type).toBe('enabled');
    });

    it('should not set thinking when reasoning is not specified', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body.thinking).toBeUndefined();
    });
  });

  describe('citations', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-citations');
    });

    it('should extract citations from response', async () => {
      const mockGenerateId = vi.fn().mockReturnValue('test-citation-id');
      const testProvider = createCohere({
        apiKey: 'test-api-key',
        generateId: mockGenerateId,
      });
      const testModel = testProvider('command-r-plus');

      const result = await testModel.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What are AI benefits?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: 'AI provides automation and efficiency.',
                },
                mediaType: 'text/plain',
                filename: 'ai-benefits.txt',
              },
            ],
          },
        ],
      });

      expect(result).toMatchSnapshot();
    });

    it('should extract text documents and send to API', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What does this say?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: 'This is a test document.',
                },
                mediaType: 'text/plain',
                filename: 'test.txt',
              },
            ],
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            {
              "data": {
                "text": "This is a test document.",
                "title": "test.txt",
              },
            },
          ],
          "messages": [
            {
              "content": "What does this say?",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
        }
      `);
    });

    it('should extract multiple text documents', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do these documents say?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('First document content'),
                },
                mediaType: 'text/plain',
                filename: 'doc1.txt',
              },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('Second document content'),
                },
                mediaType: 'text/plain',
                filename: 'doc2.txt',
              },
            ],
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            {
              "data": {
                "text": "First document content",
                "title": "doc1.txt",
              },
            },
            {
              "data": {
                "text": "Second document content",
                "title": "doc2.txt",
              },
            },
          ],
          "messages": [
            {
              "content": "What do these documents say?",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
        }
      `);
    });

    it('should support JSON files', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this JSON?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('{"key": "value"}'),
                },
                mediaType: 'application/json',
                filename: 'data.json',
              },
            ],
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "documents": [
            {
              "data": {
                "text": "{"key": "value"}",
                "title": "data.json",
              },
            },
          ],
          "messages": [
            {
              "content": "What is in this JSON?",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
        }
      `);
    });

    it('should not include mediaType in the outgoing payload (category D)', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('Some file content'),
                },
                mediaType: 'application/pdf',
                filename: 'document.pdf',
              },
            ],
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.documents).toEqual([
        {
          data: {
            text: 'Some file content',
            title: 'document.pdf',
          },
        },
      ]);
      expect(JSON.stringify(requestBody)).not.toContain('application/pdf');
      expect(JSON.stringify(requestBody)).not.toContain('mediaType');
    });

    it('should successfully process supported text media types', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('This is plain text content'),
                },
                mediaType: 'text/plain',
                filename: 'text.txt',
              },
              {
                type: 'file',
                data: {
                  type: 'data' as const,
                  data: Buffer.from('# Markdown Header\nContent'),
                },
                mediaType: 'text/markdown',
                filename: 'doc.md',
              },
            ],
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        documents: [
          {
            data: {
              text: 'This is plain text content',
              title: 'text.txt',
            },
          },
          {
            data: {
              text: '# Markdown Header\nContent',
              title: 'doc.md',
            },
          },
        ],
      });
    });

    it('should not include documents parameter when no files present', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.documents).toBeUndefined();
    });
  });

  describe('request', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('cohere-text');
    });

    it('should pass model and messages', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "you are a friendly bot!",
              "role": "system",
            },
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
        }
      `);
    });

    it('should pass tools', async () => {
      await model.doGenerate({
        toolChoice: { type: 'none' },
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            inputSchema: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "you are a friendly bot!",
              "role": "system",
            },
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
          "tool_choice": "NONE",
          "tools": [
            {
              "function": {
                "name": "test-tool",
                "parameters": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "additionalProperties": false,
                  "properties": {
                    "value": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "value",
                  ],
                  "type": "object",
                },
              },
              "type": "function",
            },
          ],
        }
      `);
    });

    it('should pass headers', async () => {
      const provider = createCohere({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider('command-r-plus').doGenerate({
        prompt: TEST_PROMPT,
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer test-api-key",
          "content-type": "application/json",
          "custom-provider-header": "provider-header-value",
          "custom-request-header": "request-header-value",
        }
      `);
    });

    it('should pass response format', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "you are a friendly bot!",
              "role": "system",
            },
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
          "response_format": {
            "json_schema": {
              "properties": {
                "text": {
                  "type": "string",
                },
              },
              "required": [
                "text",
              ],
              "type": "object",
            },
            "type": "json_object",
          },
        }
      `);
    });

    it('should send request body', async () => {
      const { request } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(request).toMatchInlineSnapshot(`
        {
          "body": {
            "frequency_penalty": undefined,
            "k": undefined,
            "max_tokens": undefined,
            "messages": [
              {
                "content": "you are a friendly bot!",
                "role": "system",
              },
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "command-r-plus",
            "p": undefined,
            "presence_penalty": undefined,
            "response_format": undefined,
            "seed": undefined,
            "stop_sequences": undefined,
            "temperature": undefined,
            "tool_choice": undefined,
            "tools": undefined,
          },
        }
      `);
    });

    it('should expose the raw response headers', async () => {
      prepareJsonFixtureResponse('cohere-text', {
        'test-header': 'test-value',
      });

      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "content-length": "304",
          "content-type": "application/json",
          "test-header": "test-value",
        }
      `);
    });

    it('should extract usage', async () => {
      prepareJsonFixtureResponse('cohere-text');

      const { usage } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": undefined,
            "cacheWrite": undefined,
            "noCache": 507,
            "total": 507,
          },
          "outputTokens": {
            "reasoning": undefined,
            "text": 10,
            "total": 10,
          },
          "raw": {
            "input_tokens": 507,
            "output_tokens": 10,
          },
        }
      `);
    });

    it('should send additional response information', async () => {
      prepareJsonFixtureResponse('cohere-text');

      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect({
        id: response?.id,
        timestamp: response?.timestamp,
        modelId: response?.modelId,
      }).toMatchInlineSnapshot(`
        {
          "id": undefined,
          "modelId": undefined,
          "timestamp": undefined,
        }
      `);
    });
  });
});

describe('doStream', () => {
  describe('text', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('cohere-text');
    });

    it('should stream text deltas', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });

    it('should include raw chunks when includeRawChunks is enabled', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: true,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toMatchSnapshot();
    });

    it('should not include raw chunks when includeRawChunks is false', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('cohere-reasoning');
    });

    it('should stream reasoning deltas', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('tool call', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('cohere-tool-call');
    });

    it('should stream tool deltas', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            inputSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        includeRawChunks: false,
      });

      const responseArray = await convertReadableStreamToArray(stream);

      expect(responseArray).toMatchSnapshot();

      const toolCallIds = responseArray
        .filter(
          chunk =>
            chunk.type === 'tool-input-delta' || chunk.type === 'tool-call',
        )
        .map(chunk =>
          chunk.type === 'tool-call' ? chunk.toolCallId : chunk.id,
        );
    });

    it('rejects prototype keys in streamed tool call arguments', async () => {
      prepareChunkLinesResponse([
        {
          type: 'tool-call-start',
          index: 0,
          delta: {
            message: {
              tool_calls: {
                id: 'test-tool-call',
                type: 'function',
                function: { name: 'test-tool', arguments: '' },
              },
            },
          },
        },
        {
          type: 'tool-call-delta',
          index: 0,
          delta: {
            message: {
              tool_calls: {
                function: {
                  arguments: '{"__proto__":{"polluted":true}}',
                },
              },
            },
          },
        },
        {
          type: 'tool-call-end',
          index: 0,
        },
      ]);

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: true,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        includeRawChunks: false,
      });

      await expect(convertReadableStreamToArray(stream)).rejects.toThrow(
        'Object contains forbidden prototype property',
      );
    });
  });

  describe('empty tool call', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('cohere-empty-tool-call');
    });

    it('should handle empty tool call arguments', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('error handling', () => {
    it('should handle unparsable stream parts', async () => {
      server.urls['https://api.cohere.com/v2/chat'].response = {
        type: 'stream-chunks',
        chunks: [`event: foo-message\ndata: {unparsable}\n\n`],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('request', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('cohere-text');
    });

    it('should pass the messages and the model', async () => {
      await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "you are a friendly bot!",
              "role": "system",
            },
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "command-r-plus",
          "stream": true,
        }
      `);
    });

    it('should pass headers', async () => {
      const provider = createCohere({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider('command-r-plus').doStream({
        prompt: TEST_PROMPT,
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
        includeRawChunks: false,
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer test-api-key",
          "content-type": "application/json",
          "custom-provider-header": "provider-header-value",
          "custom-request-header": "request-header-value",
        }
      `);
    });

    it('should send request body', async () => {
      const { request } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(request).toMatchInlineSnapshot(`
        {
          "body": {
            "frequency_penalty": undefined,
            "k": undefined,
            "max_tokens": undefined,
            "messages": [
              {
                "content": "you are a friendly bot!",
                "role": "system",
              },
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "command-r-plus",
            "p": undefined,
            "presence_penalty": undefined,
            "response_format": undefined,
            "seed": undefined,
            "stop_sequences": undefined,
            "stream": true,
            "temperature": undefined,
            "tool_choice": undefined,
            "tools": undefined,
          },
        }
      `);
    });

    it('should expose the raw response headers', async () => {
      prepareChunksFixtureResponse('cohere-text', {
        'test-header': 'test-value',
      });

      const { response } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "test-header": "test-value",
        }
      `);
    });
  });
});
