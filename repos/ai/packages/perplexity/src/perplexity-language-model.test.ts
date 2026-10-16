import {
  InvalidArgumentError,
  type LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PerplexityLanguageModel } from './perplexity-language-model';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const CHAT_COMPLETIONS_URL = 'https://api.perplexity.ai/chat/completions';

const modelId = 'sonar';

const perplexityModel = new PerplexityLanguageModel(modelId, {
  baseURL: 'https://api.perplexity.ai',
  headers: () => ({
    authorization: 'Bearer test-token',
    'content-type': 'application/json',
  }),
  generateId: mockId(),
});

const server = createTestServer({
  [CHAT_COMPLETIONS_URL]: {},
});

describe('doGenerate', () => {
  function prepareJsonFixtureResponse(
    filename: string,
    { headers }: { headers?: Record<string, string> } = {},
  ) {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      headers,
      body: JSON.parse(
        fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
  }

  describe('text', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('perplexity-text');
    });

    it('should extract text content', async () => {
      const result = await perplexityModel.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('citations', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('perplexity-citations');
    });

    it('should extract citation content', async () => {
      const result = await perplexityModel.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  it('should send correct request body', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    await perplexityModel.doGenerate({
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
        "model": "sonar",
      }
    `);
  });

  it('should pass through perplexity provider options', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        perplexity: {
          search_recency_filter: 'month',
          return_images: true,
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
        "model": "sonar",
        "return_images": true,
        "search_recency_filter": "month",
      }
    `);
  });

  it('should pass through unknown perplexity provider options', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'test-id',
        created: 1680000000,
        model: modelId,
        choices: [
          {
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    };

    await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        perplexity: {
          future_option: {
            enabled: true,
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "future_option": {
          "enabled": true,
        },
        "messages": [
          {
            "content": "Hello",
            "role": "user",
          },
        ],
        "model": "sonar",
      }
    `);
  });

  it('should reject invalid perplexity provider options', async () => {
    await expect(
      perplexityModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          perplexity: {
            search_recency_filter: 'decade',
          },
        },
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    const model = new PerplexityLanguageModel(modelId, {
      baseURL: 'https://api.perplexity.ai',
      headers: () => ({
        authorization: 'Bearer test-api-key',
        'Custom-Provider-Header': 'provider-header-value',
      }),
      generateId: mockId(),
    });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      headers: { 'Custom-Request-Header': 'request-header-value' },
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

  it('should expose the raw response headers', async () => {
    prepareJsonFixtureResponse('perplexity-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "2786",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should extract usage', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    const { usage } = await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 11,
          "total": 11,
        },
        "outputTokens": {
          "reasoning": 0,
          "text": 392,
          "total": 392,
        },
        "raw": {
          "completion_tokens": 392,
          "prompt_tokens": 11,
          "total_tokens": 403,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    const { response } = await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect({
      id: response?.id,
      timestamp: response?.timestamp,
      modelId: response?.modelId,
    }).toMatchInlineSnapshot(`
      {
        "id": "aec30d94-c6a5-4d30-935e-97dbe8de9f85",
        "modelId": "sonar",
        "timestamp": 2026-02-11T00:03:40.000Z,
      }
    `);
  });

  it('should handle PDF files with base64 encoding', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this PDF' },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: { type: 'data' as const, data: 'mock-pdf-data' },
            filename: 'test.pdf',
          },
        ],
      },
    ];

    await perplexityModel.doGenerate({ prompt });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;

    expect(requestBody.messages[0].content).toMatchInlineSnapshot(`
      [
        {
          "text": "Analyze this PDF",
          "type": "text",
        },
        {
          "file_name": "test.pdf",
          "file_url": {
            "url": "mock-pdf-data",
          },
          "type": "file_url",
        },
      ]
    `);
  });

  it('should handle PDF files with URLs', async () => {
    prepareJsonFixtureResponse('perplexity-text');

    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this PDF' },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/test.pdf'),
            },
            filename: 'test.pdf',
          },
        ],
      },
    ];

    await perplexityModel.doGenerate({ prompt });

    const requestBody =
      await server.calls[server.calls.length - 1].requestBodyJson;

    expect(requestBody.messages[0].content).toMatchInlineSnapshot(`
      [
        {
          "text": "Analyze this PDF",
          "type": "text",
        },
        {
          "file_name": "test.pdf",
          "file_url": {
            "url": "https://example.com/test.pdf",
          },
          "type": "file_url",
        },
      ]
    `);
  });

  it('should extract images', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'test-id',
        created: 1680000000,
        model: modelId,
        choices: [
          {
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        images: [
          {
            image_url: 'https://example.com/image.jpg',
            origin_url: 'https://example.com/image.jpg',
            height: 100,
            width: 100,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    };

    const result = await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.providerMetadata).toMatchInlineSnapshot(`
      {
        "perplexity": {
          "cost": null,
          "images": [
            {
              "height": 100,
              "imageUrl": "https://example.com/image.jpg",
              "originUrl": "https://example.com/image.jpg",
              "width": 100,
            },
          ],
          "usage": {
            "citationTokens": null,
            "numSearchQueries": null,
          },
        },
      }
    `);
  });

  it('should extract extended usage', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'test-id',
        created: 1680000000,
        model: modelId,
        choices: [
          {
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          citation_tokens: 30,
          num_search_queries: 40,
          reasoning_tokens: 50,
        },
      },
    };

    const result = await perplexityModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 10,
          "total": 10,
        },
        "outputTokens": {
          "reasoning": 50,
          "text": -30,
          "total": 20,
        },
        "raw": {
          "citation_tokens": 30,
          "completion_tokens": 20,
          "num_search_queries": 40,
          "prompt_tokens": 10,
          "reasoning_tokens": 50,
          "total_tokens": 30,
        },
      }
    `);

    expect(result.providerMetadata).toMatchInlineSnapshot(`
      {
        "perplexity": {
          "cost": null,
          "images": null,
          "usage": {
            "citationTokens": 30,
            "numSearchQueries": 40,
          },
        },
      }
    `);
  });

  describe('warnings', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('perplexity-text');
    });

    it('should warn about unsupported reasoning', async () => {
      const result = await perplexityModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unsupported',
          feature: 'reasoning',
        }),
      );
    });
  });
});

describe('doStream', () => {
  function prepareChunksFixtureResponse(
    filename: string,
    { headers }: { headers?: Record<string, string> } = {},
  ) {
    const chunks = fs
      .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `data: ${line}\n\n`);
    chunks.push('data: [DONE]\n\n');

    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      headers,
      chunks,
    };
  }

  describe('text', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('perplexity-text');
    });

    it('should stream text', async () => {
      const result = await perplexityModel.doStream({
        prompt: TEST_PROMPT,
      });

      expect(
        await convertReadableStreamToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  describe('citations', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('perplexity-citations');
    });

    it('should stream citations', async () => {
      const result = await perplexityModel.doStream({
        prompt: TEST_PROMPT,
      });

      expect(
        await convertReadableStreamToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  it('should send correct streaming request body', async () => {
    prepareChunksFixtureResponse('perplexity-text');

    await perplexityModel.doStream({
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
        "model": "sonar",
        "stream": true,
      }
    `);
  });

  it('should pass headers', async () => {
    prepareChunksFixtureResponse('perplexity-text');

    const model = new PerplexityLanguageModel(modelId, {
      baseURL: 'https://api.perplexity.ai',
      headers: () => ({
        authorization: 'Bearer test-api-key',
        'Custom-Provider-Header': 'provider-header-value',
      }),
      generateId: mockId(),
    });

    await model.doStream({
      prompt: TEST_PROMPT,
      headers: { 'Custom-Request-Header': 'request-header-value' },
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

  it('should expose the raw response headers', async () => {
    prepareChunksFixtureResponse('perplexity-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await perplexityModel.doStream({
      prompt: TEST_PROMPT,
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

  it('should stream images', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          id: 'stream-id',
          created: 1680003600,
          model: modelId,
          images: [
            {
              image_url: 'https://example.com/image.jpg',
              origin_url: 'https://example.com/image.jpg',
              height: 100,
              width: 100,
            },
          ],
          choices: [
            {
              delta: { role: 'assistant', content: 'Hello' },
              finish_reason: null,
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          id: 'stream-id',
          created: 1680003600,
          model: modelId,
          choices: [
            {
              delta: { role: 'assistant', content: '' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        })}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await perplexityModel.doStream({
      prompt: TEST_PROMPT,
    });

    const result = await convertReadableStreamToArray(stream);
    const finish = result.find(c => c.type === 'finish');

    expect(finish?.providerMetadata).toMatchInlineSnapshot(`
      {
        "perplexity": {
          "cost": null,
          "images": [
            {
              "height": 100,
              "imageUrl": "https://example.com/image.jpg",
              "originUrl": "https://example.com/image.jpg",
              "width": 100,
            },
          ],
          "usage": {
            "citationTokens": null,
            "numSearchQueries": null,
          },
        },
      }
    `);
  });

  it('should stream extended usage', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          id: 'stream-id',
          created: 1680003600,
          model: modelId,
          choices: [
            {
              delta: { role: 'assistant', content: 'Hello' },
              finish_reason: null,
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          id: 'stream-id',
          created: 1680003600,
          model: modelId,
          choices: [
            {
              delta: { role: 'assistant', content: '' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 21,
            total_tokens: 32,
            citation_tokens: 30,
            num_search_queries: 40,
            reasoning_tokens: 50,
          },
        })}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await perplexityModel.doStream({
      prompt: TEST_PROMPT,
    });

    const result = await convertReadableStreamToArray(stream);
    const finish = result.find(c => c.type === 'finish');

    expect(finish?.usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 11,
          "total": 11,
        },
        "outputTokens": {
          "reasoning": 50,
          "text": -29,
          "total": 21,
        },
        "raw": {
          "citation_tokens": 30,
          "completion_tokens": 21,
          "num_search_queries": 40,
          "prompt_tokens": 11,
          "reasoning_tokens": 50,
          "total_tokens": 32,
        },
      }
    `);

    expect(finish?.providerMetadata).toMatchInlineSnapshot(`
      {
        "perplexity": {
          "cost": null,
          "images": null,
          "usage": {
            "citationTokens": 30,
            "numSearchQueries": 40,
          },
        },
      }
    `);
  });

  it('should stream raw chunks', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"ppl-123","object":"chat.completion.chunk","created":1234567890,"model":"sonar","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}],"citations":["https://example.com"]}\n\n`,
        `data: {"id":"ppl-456","object":"chat.completion.chunk","created":1234567890,"model":"sonar","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n`,
        `data: {"id":"ppl-789","object":"chat.completion.chunk","created":1234567890,"model":"sonar","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"citation_tokens":2,"num_search_queries":1}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await perplexityModel.doStream({
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
            "citations": [
              "https://example.com",
            ],
            "created": 1234567890,
            "id": "ppl-123",
            "model": "sonar",
            "object": "chat.completion.chunk",
          },
          "type": "raw",
        },
        {
          "id": "ppl-123",
          "modelId": "sonar",
          "timestamp": 2009-02-13T23:31:30.000Z,
          "type": "response-metadata",
        },
        {
          "id": "id-73",
          "sourceType": "url",
          "type": "source",
          "url": "https://example.com",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
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
            "created": 1234567890,
            "id": "ppl-456",
            "model": "sonar",
            "object": "chat.completion.chunk",
          },
          "type": "raw",
        },
        {
          "delta": " world",
          "id": "0",
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
            "created": 1234567890,
            "id": "ppl-789",
            "model": "sonar",
            "object": "chat.completion.chunk",
            "usage": {
              "citation_tokens": 2,
              "completion_tokens": 5,
              "num_search_queries": 1,
              "prompt_tokens": 10,
              "total_tokens": 15,
            },
          },
          "type": "raw",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "perplexity": {
              "cost": null,
              "images": null,
              "usage": {
                "citationTokens": 2,
                "numSearchQueries": 1,
              },
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
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
              "citation_tokens": 2,
              "completion_tokens": 5,
              "num_search_queries": 1,
              "prompt_tokens": 10,
              "total_tokens": 15,
            },
          },
        },
      ]
    `);
  });
});
