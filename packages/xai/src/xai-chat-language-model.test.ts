import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { XaiChatLanguageModel } from './xai-chat-language-model';
import { createXai } from './xai-provider';
import * as fs from 'node:fs';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const testConfig = {
  provider: 'xai.chat',
  baseURL: 'https://api.x.ai/v1',
  headers: () => ({ authorization: 'Bearer test-api-key' }),
  generateId: () => 'test-id',
};

const model = new XaiChatLanguageModel('grok-3', testConfig);

const server = createTestServer({
  'https://api.x.ai/v1/chat/completions': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.x.ai/v1/chat/completions'].response = {
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
    .filter(line => line.trim().length > 0)
    .map(line => `data: ${line}\n\n`);
  chunks.push('data: [DONE]\n\n');

  server.urls['https://api.x.ai/v1/chat/completions'].response = {
    type: 'stream-chunks',
    headers,
    chunks,
  };
}

describe('XaiChatLanguageModel', () => {
  it('should be instantiated correctly', () => {
    expect(model.modelId).toBe('grok-3');
    expect(model.provider).toBe('xai.chat');
    expect(model.specificationVersion).toBe('v4');
  });

  it('should have supported URLs', () => {
    expect(model.supportedUrls).toEqual({
      'image/*': [/^https?:\/\/.*$/],
    });
  });

  describe('doGenerate', () => {
    describe('text', () => {
      beforeEach(() => prepareJsonFixtureResponse('xai-text'));

      it('should extract text content', async () => {
        const result = await model.doGenerate({ prompt: TEST_PROMPT });
        expect(result).toMatchSnapshot();
      });
    });

    describe('tool call', () => {
      beforeEach(() => prepareJsonFixtureResponse('xai-tool-call'));

      it('should extract tool call content', async () => {
        const result = await model.doGenerate({ prompt: TEST_PROMPT });
        expect(result).toMatchSnapshot();
      });
    });

    it('should extract usage', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { usage } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 2,
            "cacheWrite": undefined,
            "noCache": 10,
            "total": 12,
          },
          "outputTokens": {
            "reasoning": 228,
            "text": 1,
            "total": 229,
          },
          "raw": {
            "completion_tokens": 1,
            "completion_tokens_details": {
              "accepted_prediction_tokens": 0,
              "audio_tokens": 0,
              "reasoning_tokens": 228,
              "rejected_prediction_tokens": 0,
            },
            "prompt_tokens": 12,
            "prompt_tokens_details": {
              "audio_tokens": 0,
              "cached_tokens": 2,
              "image_tokens": 0,
              "text_tokens": 12,
            },
            "total_tokens": 241,
          },
        }
      `);
    });

    it('should send additional response information', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect({
        id: response?.id,
        timestamp: response?.timestamp,
        modelId: response?.modelId,
      }).toMatchInlineSnapshot(`
        {
          "id": "2af5c888-e886-6dcb-7844-95f8fe010b00",
          "modelId": "grok-3-mini",
          "timestamp": 2026-02-11T01:40:46.000Z,
        }
      `);
    });

    it('should expose the raw response headers', async () => {
      prepareJsonFixtureResponse('xai-text', {
        'test-header': 'test-value',
      });

      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "content-length": "827",
          "content-type": "application/json",
          "test-header": "test-value",
        }
      `);
    });

    it('should avoid duplication when there is a trailing assistant message', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { content } = await model.doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'prefix ' }],
          },
        ],
      });

      expect(content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello",
            "type": "text",
          },
          {
            "text": "First, the user said: "Say a single word." That's straightforward. They want me to respond with just one word.

        Response: I'll go with "Hello" as it's a common greeting and keeps it simple.",
            "type": "reasoning",
          },
        ]
      `);
    });

    it('should pass the model and the messages', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
        }
      `);
    });

    it('should pass tools and toolChoice', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
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
        toolChoice: {
          type: 'tool',
          toolName: 'test-tool',
        },
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "tool_choice": {
            "function": {
              "name": "test-tool",
            },
            "type": "function",
          },
          "tools": [
            {
              "function": {
                "name": "test-tool",
                "parameters": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
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

    it('should pass parallel_function_calling provider option', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            parallel_function_calling: false,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        model: 'grok-3',
        messages: [{ role: 'user', content: 'Hello' }],
        parallel_function_calling: false,
      });
    });

    it('should pass headers', async () => {
      prepareJsonFixtureResponse('xai-text');

      const modelWithHeaders = new XaiChatLanguageModel('grok-3', {
        provider: 'xai.chat',
        baseURL: 'https://api.x.ai/v1',
        headers: () => ({
          authorization: 'Bearer test-api-key',
          'Custom-Provider-Header': 'provider-header-value',
        }),

        generateId: () => 'test-id',
      });

      await modelWithHeaders.doGenerate({
        prompt: TEST_PROMPT,
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      const requestHeaders = server.calls[0].requestHeaders;

      expect(requestHeaders).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer test-api-key",
          "content-type": "application/json",
          "custom-provider-header": "provider-header-value",
          "custom-request-header": "request-header-value",
        }
      `);
    });

    it('should include provider user agent when using createXai', async () => {
      prepareJsonFixtureResponse('xai-text');

      const xai = createXai({
        apiKey: 'test-api-key',
        headers: { 'Custom-Provider-Header': 'provider-header-value' },
      });

      const modelWithHeaders = xai.chat('grok-3');

      await modelWithHeaders.doGenerate({
        prompt: TEST_PROMPT,
        headers: { 'Custom-Request-Header': 'request-header-value' },
      });

      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/xai/0.0.0-test`,
      );
    });

    it('should send request body', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { request } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(request).toMatchInlineSnapshot(`
        {
          "body": {
            "logprobs": undefined,
            "max_completion_tokens": undefined,
            "messages": [
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "grok-3",
            "parallel_function_calling": undefined,
            "reasoning_effort": undefined,
            "response_format": undefined,
            "search_parameters": undefined,
            "seed": undefined,
            "temperature": undefined,
            "tool_choice": undefined,
            "tools": undefined,
            "top_logprobs": undefined,
            "top_p": undefined,
          },
        }
      `);
    });

    it('should pass logprobs provider options', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            logprobs: true,
            topLogprobs: 5,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "logprobs": true,
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "top_logprobs": 5,
        }
      `);
    });

    it('should enable logprobs when topLogprobs is set', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            topLogprobs: 3,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "logprobs": true,
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "top_logprobs": 3,
        }
      `);
    });

    it('should pass search parameters', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'auto',
              returnCitations: true,
              fromDate: '2024-01-01',
              toDate: '2024-12-31',
              maxSearchResults: 10,
            },
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "search_parameters": {
            "from_date": "2024-01-01",
            "max_search_results": 10,
            "mode": "auto",
            "return_citations": true,
            "to_date": "2024-12-31",
          },
        }
      `);
    });

    it('should pass search parameters with sources array', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'on',
              sources: [
                {
                  type: 'web',
                  country: 'US',
                  excludedWebsites: ['example.com'],
                  safeSearch: false,
                },
                {
                  type: 'x',
                  includedXHandles: ['grok'],
                  excludedXHandles: ['openai'],
                  postFavoriteCount: 5,
                  postViewCount: 50,
                },
                {
                  type: 'news',
                  country: 'GB',
                },
                {
                  type: 'rss',
                  links: ['https://status.x.ai/feed.xml'],
                },
              ],
            },
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "search_parameters": {
            "mode": "on",
            "sources": [
              {
                "country": "US",
                "excluded_websites": [
                  "example.com",
                ],
                "safe_search": false,
                "type": "web",
              },
              {
                "excluded_x_handles": [
                  "openai",
                ],
                "included_x_handles": [
                  "grok",
                ],
                "post_favorite_count": 5,
                "post_view_count": 50,
                "type": "x",
              },
              {
                "country": "GB",
                "type": "news",
              },
              {
                "links": [
                  "https://status.x.ai/feed.xml",
                ],
                "type": "rss",
              },
            ],
          },
        }
      `);
    });

    it('should extract content when message content is a content object', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'object-id',
          object: 'chat.completion',
          created: 1699472111,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello from object',
                tool_calls: null,
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
        },
      };

      const { content } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello from object",
            "type": "text",
          },
        ]
      `);
    });

    it('should extract citations as sources', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'citations-test',
          object: 'chat.completion',
          created: 1699472111,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Here are the latest developments in AI.',
                tool_calls: null,
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
          citations: [
            'https://example.com/article1',
            'https://example.com/article2',
          ],
        },
      };

      const { content } = await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'auto',
              returnCitations: true,
            },
          },
        },
      });

      expect(content).toMatchInlineSnapshot(`
        [
          {
            "text": "Here are the latest developments in AI.",
            "type": "text",
          },
          {
            "id": "test-id",
            "sourceType": "url",
            "type": "source",
            "url": "https://example.com/article1",
          },
          {
            "id": "test-id",
            "sourceType": "url",
            "type": "source",
            "url": "https://example.com/article2",
          },
        ]
      `);
    });

    it('should handle complex search parameter combinations', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'on',
              returnCitations: true,
              fromDate: '2024-01-01',
              toDate: '2024-12-31',
              maxSearchResults: 15,
              sources: [
                {
                  type: 'web',
                  country: 'US',
                  allowedWebsites: ['arxiv.org', 'nature.com'],
                  safeSearch: true,
                },
                {
                  type: 'news',
                  country: 'GB',
                  excludedWebsites: ['tabloid.com'],
                },
                {
                  type: 'x',
                  includedXHandles: ['openai', 'deepmind'],
                  excludedXHandles: ['grok'],
                  postFavoriteCount: 10,
                  postViewCount: 100,
                },
              ],
            },
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "search_parameters": {
            "from_date": "2024-01-01",
            "max_search_results": 15,
            "mode": "on",
            "return_citations": true,
            "sources": [
              {
                "allowed_websites": [
                  "arxiv.org",
                  "nature.com",
                ],
                "country": "US",
                "safe_search": true,
                "type": "web",
              },
              {
                "country": "GB",
                "excluded_websites": [
                  "tabloid.com",
                ],
                "type": "news",
              },
              {
                "excluded_x_handles": [
                  "grok",
                ],
                "included_x_handles": [
                  "openai",
                  "deepmind",
                ],
                "post_favorite_count": 10,
                "post_view_count": 100,
                "type": "x",
              },
            ],
            "to_date": "2024-12-31",
          },
        }
      `);
    });

    it('should handle empty citations array', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'no-citations-test',
          object: 'chat.completion',
          created: 1699472111,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Response without citations.',
                tool_calls: null,
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
          citations: [],
        },
      };

      const { content } = await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'auto',
              returnCitations: true,
            },
          },
        },
      });

      expect(content).toMatchInlineSnapshot(`
        [
          {
            "text": "Response without citations.",
            "type": "text",
          },
        ]
      `);
    });

    it('should support json schema response format without warnings', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { warnings } = await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      });

      expect(warnings).toEqual([]);
    });

    it('should send json schema in response format', async () => {
      prepareJsonFixtureResponse('xai-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          name: 'person',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        model: 'grok-3',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'person',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
              required: ['name'],
            },
            strict: true,
          },
        },
      });
    });

    it('should handle missing usage in response', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'no-usage-test',
          object: 'chat.completion',
          created: 1699472111,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello',
                tool_calls: null,
              },
              finish_reason: 'stop',
            },
          ],
        },
      };

      const { usage } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 0,
            "cacheWrite": 0,
            "noCache": 0,
            "total": 0,
          },
          "outputTokens": {
            "reasoning": 0,
            "text": 0,
            "total": 0,
          },
        }
      `);
    });
  });

  describe('doStream', () => {
    describe('text', () => {
      beforeEach(() => prepareChunksFixtureResponse('xai-text'));

      it('should stream text content', async () => {
        const { stream } = await model.doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });
    });

    describe('tool call', () => {
      beforeEach(() => prepareChunksFixtureResponse('xai-tool-call'));

      it('should stream tool call content', async () => {
        const { stream } = await model.doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });
    });

    it('should expose the raw response headers', async () => {
      prepareChunksFixtureResponse('xai-text', {
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

    it('should avoid duplication when there is a trailing assistant message', async () => {
      prepareChunksFixtureResponse('xai-text');

      const { stream } = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'prefix ' }],
          },
        ],
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);
      const textDeltas = chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.delta);

      expect(textDeltas).toMatchInlineSnapshot(`
        [
          "Hello",
        ]
      `);
    });

    it('should pass the messages', async () => {
      prepareChunksFixtureResponse('xai-text');

      await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "stream": true,
          "stream_options": {
            "include_usage": true,
          },
        }
      `);
    });

    it('should pass headers', async () => {
      prepareChunksFixtureResponse('xai-text');

      const modelWithHeaders = new XaiChatLanguageModel('grok-3', {
        provider: 'xai.chat',
        baseURL: 'https://api.x.ai/v1',
        headers: () => ({
          authorization: 'Bearer test-api-key',
          'Custom-Provider-Header': 'provider-header-value',
        }),
        generateId: () => 'test-id',
      });

      await modelWithHeaders.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
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

    it('should send request body', async () => {
      prepareChunksFixtureResponse('xai-text');

      const { request } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(request).toMatchInlineSnapshot(`
        {
          "body": {
            "logprobs": undefined,
            "max_completion_tokens": undefined,
            "messages": [
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "grok-3",
            "parallel_function_calling": undefined,
            "reasoning_effort": undefined,
            "response_format": undefined,
            "search_parameters": undefined,
            "seed": undefined,
            "stream": true,
            "stream_options": {
              "include_usage": true,
            },
            "temperature": undefined,
            "tool_choice": undefined,
            "tools": undefined,
            "top_logprobs": undefined,
            "top_p": undefined,
          },
        }
      `);
    });

    it('should handle missing usage in streaming response', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"no-usage-test","object":"chat.completion.chunk","created":1750537778,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
          `data: {"id":"no-usage-test","object":"chat.completion.chunk","created":1750537778,"model":"grok-3","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
          `data: {"id":"no-usage-test","object":"chat.completion.chunk","created":1750537778,"model":"grok-3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
          `data: [DONE]\n\n`,
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);
      const finishChunk = chunks.find(chunk => chunk.type === 'finish');

      expect(finishChunk).toMatchObject({
        type: 'finish',
        finishReason: {
          unified: 'stop',
          raw: 'stop',
        },
        usage: {
          inputTokens: {
            total: 0,
            noCache: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 0,
            text: 0,
            reasoning: 0,
          },
        },
      });
    });

    it('should stream citations as sources', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c","object":"chat.completion.chunk","created":1750538200,"model":"grok-3",` +
            `"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
          `data: {"id":"c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c","object":"chat.completion.chunk","created":1750538200,"model":"grok-3",` +
            `"choices":[{"index":0,"delta":{"content":"Latest AI news"},"finish_reason":null}],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
          `data: {"id":"c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c","object":"chat.completion.chunk","created":1750538200,"model":"grok-3",` +
            `"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],` +
            `"usage":{"prompt_tokens":4,"total_tokens":34,"completion_tokens":30},` +
            `"citations":["https://example.com/source1","https://example.com/source2"],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
          `data: [DONE]\n\n`,
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'auto',
              returnCitations: true,
            },
          },
        },
      });

      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c",
            "modelId": "grok-3",
            "timestamp": 2025-06-21T20:36:40.000Z,
            "type": "response-metadata",
          },
          {
            "id": "text-c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c",
            "type": "text-start",
          },
          {
            "delta": "Latest AI news",
            "id": "text-c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c",
            "type": "text-delta",
          },
          {
            "id": "test-id",
            "sourceType": "url",
            "type": "source",
            "url": "https://example.com/source1",
          },
          {
            "id": "test-id",
            "sourceType": "url",
            "type": "source",
            "url": "https://example.com/source2",
          },
          {
            "id": "text-c8e45f92-7a3b-4d8e-9c1f-5e6a8b9d2f4c",
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": "stop",
              "unified": "stop",
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 4,
                "total": 4,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 30,
                "total": 30,
              },
              "raw": {
                "completion_tokens": 30,
                "prompt_tokens": 4,
                "total_tokens": 34,
              },
            },
          },
        ]
      `);
    });
  });

  describe('reasoning models', () => {
    const reasoningModel = new XaiChatLanguageModel('grok-3-mini', testConfig);

    it('should pass reasoning_effort parameter', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: { reasoningEffort: 'high' },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3-mini",
          "reasoning_effort": "high",
        }
      `);
    });

    it('should pass reasoning_effort: "none" via providerOptions', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: { reasoningEffort: 'none' },
        },
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'none',
      );
    });

    it('should map top-level reasoning to reasoning_effort', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should map top-level reasoning medium to reasoning_effort: "medium"', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'medium',
      );
    });

    it('should pass reasoning_effort: "medium" via providerOptions', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: { reasoningEffort: 'medium' },
        },
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'medium',
      );
    });

    it('should coerce top-level reasoning xhigh to high', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'xhigh',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should not set reasoning_effort for top-level reasoning none', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      expect(
        (await server.calls[0].requestBodyJson).reasoning_effort,
      ).toBeUndefined();
    });

    it('should prefer providerOptions reasoningEffort over top-level reasoning', async () => {
      prepareJsonFixtureResponse('xai-text');

      await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
        providerOptions: {
          xai: { reasoningEffort: 'high' },
        },
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should extract reasoning content', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { content } = await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: { reasoningEffort: 'low' },
        },
      });

      expect(content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello",
            "type": "text",
          },
          {
            "text": "First, the user said: "Say a single word." That's straightforward. They want me to respond with just one word.

        Response: I'll go with "Hello" as it's a common greeting and keeps it simple.",
            "type": "reasoning",
          },
        ]
      `);
    });

    it('should extract reasoning tokens from usage', async () => {
      prepareJsonFixtureResponse('xai-text');

      const { usage } = await reasoningModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          xai: { reasoningEffort: 'high' },
        },
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 2,
            "cacheWrite": undefined,
            "noCache": 10,
            "total": 12,
          },
          "outputTokens": {
            "reasoning": 228,
            "text": 1,
            "total": 229,
          },
          "raw": {
            "completion_tokens": 1,
            "completion_tokens_details": {
              "accepted_prediction_tokens": 0,
              "audio_tokens": 0,
              "reasoning_tokens": 228,
              "rejected_prediction_tokens": 0,
            },
            "prompt_tokens": 12,
            "prompt_tokens_details": {
              "audio_tokens": 0,
              "cached_tokens": 2,
              "image_tokens": 0,
              "text_tokens": 12,
            },
            "total_tokens": 241,
          },
        }
      `);
    });

    it('should handle reasoning streaming', async () => {
      prepareChunksFixtureResponse('xai-text');

      const { stream } = await reasoningModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        providerOptions: {
          xai: { reasoningEffort: 'low' },
        },
      });

      const chunks = await convertReadableStreamToArray(stream);
      const reasoningDeltas = chunks
        .filter(chunk => chunk.type === 'reasoning-delta')
        .map(chunk => chunk.delta);

      expect(reasoningDeltas).toMatchInlineSnapshot(`
        [
          "First",
          ",",
          " the",
          " user",
          " said",
        ]
      `);
    });

    it('should deduplicate repetitive reasoning deltas', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"reasoning_content":"Thinking... "},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"reasoning_content":"Thinking... "},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"reasoning_content":"Thinking... "},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"reasoning_content":"Actually calculating now..."},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{"content":"The answer is 42."},"finish_reason":null}],"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: {"id":"grok-4-test","object":"chat.completion.chunk","created":1750538120,"model":"grok-4-0709",` +
            `"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],` +
            `"usage":{"prompt_tokens":15,"total_tokens":35,"completion_tokens":20,"completion_tokens_details":{"reasoning_tokens":10}},"system_fingerprint":"fp_reasoning_v1"}\n\n`,
          `data: [DONE]\n\n`,
        ],
      };

      const { stream } = await reasoningModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        providerOptions: {
          xai: { reasoningEffort: 'low' },
        },
      });

      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "grok-4-test",
            "modelId": "grok-4-0709",
            "timestamp": 2025-06-21T20:35:20.000Z,
            "type": "response-metadata",
          },
          {
            "id": "reasoning-grok-4-test",
            "type": "reasoning-start",
          },
          {
            "delta": "Thinking... ",
            "id": "reasoning-grok-4-test",
            "type": "reasoning-delta",
          },
          {
            "delta": "Actually calculating now...",
            "id": "reasoning-grok-4-test",
            "type": "reasoning-delta",
          },
          {
            "id": "reasoning-grok-4-test",
            "type": "reasoning-end",
          },
          {
            "id": "text-grok-4-test",
            "type": "text-start",
          },
          {
            "delta": "The answer is 42.",
            "id": "text-grok-4-test",
            "type": "text-delta",
          },
          {
            "id": "text-grok-4-test",
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": "stop",
              "unified": "stop",
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 15,
                "total": 15,
              },
              "outputTokens": {
                "reasoning": 10,
                "text": 20,
                "total": 30,
              },
              "raw": {
                "completion_tokens": 20,
                "completion_tokens_details": {
                  "reasoning_tokens": 10,
                },
                "prompt_tokens": 15,
                "total_tokens": 35,
              },
            },
          },
        ]
      `);
    });
  });
});

describe('doStream with raw chunks', () => {
  it('should stream raw chunks when includeRawChunks is true', async () => {
    server.urls['https://api.x.ai/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d","object":"chat.completion.chunk","created":1750538300,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
        `data: {"id":"e2a47b89-3f6d-4c8e-9a1b-7d5f8c9e2a4b","object":"chat.completion.chunk","created":1750538301,"model":"grok-3","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
        `data: {"id":"f3b58c9a-4e7f-5d9e-ab2c-8e6f9d0e3b5c","object":"chat.completion.chunk","created":1750538302,"model":"grok-3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15},"citations":["https://example.com"],"system_fingerprint":"fp_13a6dc65a6"}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    const chunks = await convertReadableStreamToArray(stream);

    expect(chunks).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "rawValue": {
            "choices": [
              {
                "delta": {
                  "content": "Hello",
                  "role": "assistant",
                },
                "finish_reason": null,
                "index": 0,
              },
            ],
            "created": 1750538300,
            "id": "d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d",
            "model": "grok-3",
            "object": "chat.completion.chunk",
            "system_fingerprint": "fp_13a6dc65a6",
          },
          "type": "raw",
        },
        {
          "id": "d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d",
          "modelId": "grok-3",
          "timestamp": 2025-06-21T20:38:20.000Z,
          "type": "response-metadata",
        },
        {
          "id": "text-d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "text-d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d",
          "type": "text-delta",
        },
        {
          "rawValue": {
            "choices": [
              {
                "delta": {
                  "content": " world",
                },
                "finish_reason": null,
                "index": 0,
              },
            ],
            "created": 1750538301,
            "id": "e2a47b89-3f6d-4c8e-9a1b-7d5f8c9e2a4b",
            "model": "grok-3",
            "object": "chat.completion.chunk",
            "system_fingerprint": "fp_13a6dc65a6",
          },
          "type": "raw",
        },
        {
          "id": "text-e2a47b89-3f6d-4c8e-9a1b-7d5f8c9e2a4b",
          "type": "text-start",
        },
        {
          "delta": " world",
          "id": "text-e2a47b89-3f6d-4c8e-9a1b-7d5f8c9e2a4b",
          "type": "text-delta",
        },
        {
          "rawValue": {
            "choices": [
              {
                "delta": {},
                "finish_reason": "stop",
                "index": 0,
              },
            ],
            "citations": [
              "https://example.com",
            ],
            "created": 1750538302,
            "id": "f3b58c9a-4e7f-5d9e-ab2c-8e6f9d0e3b5c",
            "model": "grok-3",
            "object": "chat.completion.chunk",
            "system_fingerprint": "fp_13a6dc65a6",
            "usage": {
              "completion_tokens": 5,
              "prompt_tokens": 10,
              "total_tokens": 15,
            },
          },
          "type": "raw",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "type": "source",
          "url": "https://example.com",
        },
        {
          "id": "text-d9f56e23-8b4c-4e7a-9d2f-6c8a9b5e3f7d",
          "type": "text-end",
        },
        {
          "id": "text-e2a47b89-3f6d-4c8e-9a1b-7d5f8c9e2a4b",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 10,
              "total": 10,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 5,
              "total": 5,
            },
            "raw": {
              "completion_tokens": 5,
              "prompt_tokens": 10,
              "total_tokens": 15,
            },
          },
        },
      ]
    `);
  });

  describe('error handling', () => {
    it('should throw APICallError when xai returns error with 200 status (doGenerate)', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          code: 'The service is currently unavailable',
          error: 'Timed out waiting for first token',
        },
      };

      await expect(model.doGenerate({ prompt: TEST_PROMPT })).rejects.toThrow(
        'Timed out waiting for first token',
      );
    });

    it('should throw APICallError when xai returns error with 200 status (doStream)', async () => {
      server.urls['https://api.x.ai/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          code: 'The service is currently unavailable',
          error: 'Timed out waiting for first token',
        },
      };

      await expect(model.doStream({ prompt: TEST_PROMPT })).rejects.toThrow(
        'Timed out waiting for first token',
      );
    });
  });
});
