import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMistral } from './mistral-provider';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

const provider = createMistral({
  apiKey: 'test-api-key',
  generateId: mockId(),
});
const model = provider.chat('mistral-small-latest');

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
      prepareJsonFixtureResponse('mistral-text');
    });

    it('should extract text content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });

    it('should send correct request body', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "messages": [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "model": "mistral-small-latest",
        }
      `);
    });
  });

  describe('tool call', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('mistral-tool-call');
    });

    it('should extract tool call content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('mistral-reasoning');
    });

    it('should extract reasoning content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonFixtureResponse('mistral-text');

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

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            parameters: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        },
      ],
      tool_choice: 'any',
    });
  });

  it('should forward stopSequences as the Mistral stop parameter and not warn', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      stopSequences: ['foo', 'bar'],
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      stop: ['foo', 'bar'],
    });

    expect(result.warnings).not.toContainEqual(
      expect.objectContaining({
        type: 'unsupported',
        feature: 'stopSequences',
      }),
    );
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const provider = createMistral({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('mistral-small-latest').doGenerate({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = server.calls[0].requestHeaders;

    expect(requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/mistral/0.0.0-test`,
    );
  });

  it('should expose the raw response headers', async () => {
    prepareJsonFixtureResponse('mistral-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "2287",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should extract usage', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 13,
          "total": 13,
        },
        "outputTokens": {
          "reasoning": undefined,
          "text": 434,
          "total": 434,
        },
        "raw": {
          "completion_tokens": 434,
          "prompt_tokens": 13,
          "total_tokens": 447,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect({
      id: response?.id,
      timestamp: response?.timestamp,
      modelId: response?.modelId,
    }).toMatchInlineSnapshot(`
      {
        "id": "5319bd0299614c679a0068a4f2c8ffd0",
        "modelId": "mistral-small-latest",
        "timestamp": 2026-01-22T13:32:00.000Z,
      }
    `);
  });

  it('should send request body', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "document_image_limit": undefined,
          "document_page_limit": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "model": "mistral-small-latest",
          "random_seed": undefined,
          "reasoning_effort": undefined,
          "response_format": undefined,
          "safe_prompt": undefined,
          "stop": undefined,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_p": undefined,
        },
      }
    `);
  });

  it('should inject JSON instruction for JSON response format', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
      },
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "document_image_limit": undefined,
          "document_page_limit": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": "You MUST answer with JSON.",
              "role": "system",
            },
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "model": "mistral-small-latest",
          "random_seed": undefined,
          "reasoning_effort": undefined,
          "response_format": {
            "type": "json_object",
          },
          "safe_prompt": undefined,
          "stop": undefined,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_p": undefined,
        },
      }
    `);
  });

  it('should inject JSON instruction for JSON response format with schema', async () => {
    prepareJsonFixtureResponse('mistral-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "document_image_limit": undefined,
          "document_page_limit": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "model": "mistral-small-latest",
          "random_seed": undefined,
          "reasoning_effort": undefined,
          "response_format": {
            "json_schema": {
              "description": undefined,
              "name": "response",
              "schema": {
                "properties": {
                  "name": {
                    "type": "string",
                  },
                },
                "type": "object",
              },
              "strict": false,
            },
            "type": "json_schema",
          },
          "safe_prompt": undefined,
          "stop": undefined,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_p": undefined,
        },
      }
    `);
  });

  it('should pass parallelToolCalls option', async () => {
    prepareJsonFixtureResponse('mistral-text');

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
      prompt: TEST_PROMPT,
      providerOptions: {
        mistral: {
          parallelToolCalls: false,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            parameters: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        },
      ],
      parallel_tool_calls: false,
    });
  });

  it('should avoid duplication when trailing assistant message', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: '16362f24e60340d0994dd205c267a43a',
        created: 1711113008,
        model: 'mistral-small-latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'prefix and more content',
              tool_calls: null,
            },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
      },
    };

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
          "text": "prefix and more content",
          "type": "text",
        },
      ]
    `);
  });

  it('should preserve ordering of mixed thinking and text', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'mixed-content-test',
        object: 'chat.completion',
        created: 1722349660,
        model: 'magistral-medium-2507',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'thinking',
                  thinking: [{ type: 'text', text: 'First thought.' }],
                },
                {
                  type: 'text',
                  text: 'Partial answer.',
                },
                {
                  type: 'thinking',
                  thinking: [{ type: 'text', text: 'Second thought.' }],
                },
                {
                  type: 'text',
                  text: 'Final answer.',
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, total_tokens: 30, completion_tokens: 20 },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "First thought.",
          "type": "reasoning",
        },
        {
          "text": "Partial answer.",
          "type": "text",
        },
        {
          "text": "Second thought.",
          "type": "reasoning",
        },
        {
          "text": "Final answer.",
          "type": "text",
        },
      ]
    `);
  });

  it('should handle empty thinking content', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'empty-thinking-test',
        object: 'chat.completion',
        created: 1722349660,
        model: 'magistral-medium-2507',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'thinking',
                  thinking: [],
                },
                {
                  type: 'text',
                  text: 'Just the answer.',
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, total_tokens: 30, completion_tokens: 20 },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Just the answer.",
          "type": "text",
        },
      ]
    `);
  });

  it('should extract content when message content is a content object', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: 'object-id',
        created: 1711113008,
        model: 'mistral-small-latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Hello from object',
                },
              ],
              tool_calls: null,
            },
            finish_reason: 'stop',
            logprobs: null,
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

  it('should return raw text with think tags', async () => {
    const reasoningModel = provider.chat('magistral-small-2506');

    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: 'raw-think-id',
        created: 1711113008,
        model: 'magistral-small-2506',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                "<think>\nLet me think about this problem step by step.\nFirst, I need to understand what the user is asking.\nThen I can provide a helpful response.\n</think>\n\nHello! I'm ready to help you with your question.",
              tool_calls: null,
            },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
      },
    };

    const { content } = await reasoningModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "<think>
      Let me think about this problem step by step.
      First, I need to understand what the user is asking.
      Then I can provide a helpful response.
      </think>

      Hello! I'm ready to help you with your question.",
          "type": "text",
        },
      ]
    `);
  });

  describe('warnings', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('mistral-text');
    });

    it('should warn about unsupported reasoning for non-supporting models', async () => {
      const unsupportedModel = provider.chat('mistral-large-latest');
      const result = await unsupportedModel.doGenerate({
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

    it('should emit compatibility warning for reasoning medium on supporting model', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'compatibility',
          feature: 'reasoning',
        }),
      );
    });

    it('should not warn for reasoning high on supporting model', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          feature: 'reasoning',
        }),
      );
    });
  });

  describe('reasoning_effort', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('mistral-text');
    });

    it('should send reasoning_effort high for reasoning high', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        reasoning_effort: 'high',
      });
    });

    it('should send reasoning_effort high for reasoning medium', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        reasoning_effort: 'high',
      });
    });

    it('should send reasoning_effort high for reasoning minimal', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'minimal',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        reasoning_effort: 'high',
      });
    });

    it('should send reasoning_effort none for reasoning none', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        reasoning_effort: 'none',
      });
    });

    it('should allow provider option to override reasoning', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        providerOptions: {
          mistral: { reasoningEffort: 'none' },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        reasoning_effort: 'none',
      });
    });

    it('should not send reasoning_effort for non-supporting models', async () => {
      const unsupportedModel = provider.chat('mistral-large-latest');
      await unsupportedModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      const body = await server.calls[0].requestBodyJson;
      expect(body).not.toHaveProperty('reasoning_effort');
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
      prepareChunksFixtureResponse('mistral-text');
    });

    it('should stream text', async () => {
      const result = await model.doStream({
        prompt: TEST_PROMPT,
      });

      expect(
        await convertReadableStreamToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  describe('tool call', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('mistral-tool-call');
    });

    it('should stream tool call', async () => {
      const result = await model.doStream({
        prompt: TEST_PROMPT,
      });

      expect(
        await convertReadableStreamToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('mistral-reasoning');
    });

    it('should stream reasoning', async () => {
      const result = await model.doStream({
        prompt: TEST_PROMPT,
      });

      expect(
        await convertReadableStreamToArray(result.stream),
      ).toMatchSnapshot();
    });
  });

  it('should pass the messages', async () => {
    prepareChunksFixtureResponse('mistral-text');

    await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      stream: true,
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });
  });

  it('should pass headers', async () => {
    prepareChunksFixtureResponse('mistral-text');

    const provider = createMistral({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('mistral-small-latest').doStream({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/mistral/0.0.0-test`,
    );
  });

  it('should expose the raw response headers', async () => {
    prepareChunksFixtureResponse('mistral-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doStream({
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

  it('should send request body', async () => {
    prepareChunksFixtureResponse('mistral-text');

    const { request } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "document_image_limit": undefined,
          "document_page_limit": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": [
                {
                  "text": "Hello",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "model": "mistral-small-latest",
          "random_seed": undefined,
          "reasoning_effort": undefined,
          "response_format": undefined,
          "safe_prompt": undefined,
          "stop": undefined,
          "stream": true,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_p": undefined,
        },
      }
    `);
  });

  it('should avoid duplication when trailing assistant message', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"53ff663126294946a6b7a4747b70597e","object":"chat.completion.chunk","created":1750537996,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"53ff663126294946a6b7a4747b70597e","object":"chat.completion.chunk","created":1750537996,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"role":"assistant","content":"prefix"},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"53ff663126294946a6b7a4747b70597e","object":"chat.completion.chunk","created":1750537996,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"role":"assistant","content":" and"},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"53ff663126294946a6b7a4747b70597e","object":"chat.completion.chunk","created":1750537996,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"role":"assistant","content":" more content"},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"53ff663126294946a6b7a4747b70597e","object":"chat.completion.chunk","created":1750537996,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"content":""},"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":4,"total_tokens":36,"completion_tokens":32}}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'prefix ' }],
        },
      ],
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "53ff663126294946a6b7a4747b70597e",
          "modelId": "mistral-small-latest",
          "timestamp": 2025-06-21T20:33:16.000Z,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "prefix",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": " and",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": " more content",
          "id": "0",
          "type": "text-delta",
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 4,
              "total": 4,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 32,
              "total": 32,
            },
            "raw": {
              "completion_tokens": 32,
              "prompt_tokens": 4,
              "total_tokens": 36,
            },
          },
        },
      ]
    `);
  });

  it('should stream text with content objects', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"b9e43f82d6c74a1e9f5b2c8e7a9d4f6b","object":"chat.completion.chunk","created":1750538500,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"role":"assistant","content":[{"type":"text","text":""}]},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"b9e43f82d6c74a1e9f5b2c8e7a9d4f6b","object":"chat.completion.chunk","created":1750538500,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"content":[{"type":"text","text":"Hello"}]},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"b9e43f82d6c74a1e9f5b2c8e7a9d4f6b","object":"chat.completion.chunk","created":1750538500,"model":"mistral-small-latest","choices":[{"index":0,"delta":{"content":[{"type":"text","text":", world!"}]},"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":4,"total_tokens":36,"completion_tokens":32}}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "b9e43f82d6c74a1e9f5b2c8e7a9d4f6b",
          "modelId": "mistral-small-latest",
          "timestamp": 2025-06-21T20:41:40.000Z,
          "type": "response-metadata",
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
          "delta": ", world!",
          "id": "0",
          "type": "text-delta",
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 4,
              "total": 4,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 32,
              "total": 32,
            },
            "raw": {
              "completion_tokens": 32,
              "prompt_tokens": 4,
              "total_tokens": 36,
            },
          },
        },
      ]
    `);
  });

  it('should handle interleaved thinking and text', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"interleaved-test","object":"chat.completion.chunk","created":1750538000,"model":"magistral-small-2507","choices":[{"index":0,"delta":{"role":"assistant","content":[{"type":"thinking","thinking":[{"type":"text","text":"First thought."}]}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"interleaved-test","object":"chat.completion.chunk","created":1750538000,"model":"magistral-small-2507","choices":[{"index":0,"delta":{"role":"assistant","content":[{"type":"text","text":"Partial answer."}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"interleaved-test","object":"chat.completion.chunk","created":1750538000,"model":"magistral-small-2507","choices":[{"index":0,"delta":{"role":"assistant","content":[{"type":"thinking","thinking":[{"type":"text","text":"Second thought."}]}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"interleaved-test","object":"chat.completion.chunk","created":1750538000,"model":"magistral-small-2507","choices":[{"index":0,"delta":{"role":"assistant","content":[{"type":"text","text":"Final answer."}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"interleaved-test","object":"chat.completion.chunk","created":1750538000,"model":"magistral-small-2507","choices":[{"index":0,"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"total_tokens":40,"completion_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "interleaved-test",
          "modelId": "magistral-small-2507",
          "timestamp": 2025-06-21T20:33:20.000Z,
          "type": "response-metadata",
        },
        {
          "id": "id-1",
          "type": "reasoning-start",
        },
        {
          "delta": "First thought.",
          "id": "id-1",
          "type": "reasoning-delta",
        },
        {
          "id": "id-1",
          "type": "reasoning-end",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Partial answer.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "id": "id-2",
          "type": "reasoning-start",
        },
        {
          "delta": "Second thought.",
          "id": "id-2",
          "type": "reasoning-delta",
        },
        {
          "id": "id-2",
          "type": "reasoning-end",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Final answer.",
          "id": "0",
          "type": "text-delta",
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 10,
              "total": 10,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 30,
              "total": 30,
            },
            "raw": {
              "completion_tokens": 30,
              "prompt_tokens": 10,
              "total_tokens": 40,
            },
          },
        },
      ]
    `);
  });

  it('should stream raw chunks', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"c7d54e93f8a64b2e9c1f5a8b7d9e2f4c","object":"chat.completion.chunk","created":1750538600,"model":"mistral-large-latest","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"d8e65fa4g9b75c3f0d2g6b9c8e0f3g5d","object":"chat.completion.chunk","created":1750538601,"model":"mistral-large-latest","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null,"logprobs":null}]}\n\n`,
        `data: {"id":"e9f76gb5h0c86d4g1e3h7c0d9f1g4h6e","object":"chat.completion.chunk","created":1750538602,"model":"mistral-large-latest","choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
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
                "logprobs": null,
              },
            ],
            "created": 1750538600,
            "id": "c7d54e93f8a64b2e9c1f5a8b7d9e2f4c",
            "model": "mistral-large-latest",
            "object": "chat.completion.chunk",
          },
          "type": "raw",
        },
        {
          "id": "c7d54e93f8a64b2e9c1f5a8b7d9e2f4c",
          "modelId": "mistral-large-latest",
          "timestamp": 2025-06-21T20:43:20.000Z,
          "type": "response-metadata",
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
                "logprobs": null,
              },
            ],
            "created": 1750538601,
            "id": "d8e65fa4g9b75c3f0d2g6b9c8e0f3g5d",
            "model": "mistral-large-latest",
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
                "logprobs": null,
              },
            ],
            "created": 1750538602,
            "id": "e9f76gb5h0c86d4g1e3h7c0d9f1g4h6e",
            "model": "mistral-large-latest",
            "object": "chat.completion.chunk",
            "usage": {
              "completion_tokens": 5,
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 10,
              "total": 10,
            },
            "outputTokens": {
              "reasoning": undefined,
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
});

describe('tool result format support', () => {
  it('should handle new LanguageModelV4ToolResultOutput format', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'mistral-small',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Here is the result',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      },
    };

    const result = await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              input: { query: 'test' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              output: { type: 'json', value: { result: 'success' } },
            },
          ],
        },
      ],
    });

    expect(result.content).toEqual([
      { type: 'text', text: 'Here is the result' },
    ]);

    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "stop",
        "unified": "stop",
      }
    `);
  });
});

describe('reference content parsing', () => {
  it('should handle reference_ids as numbers', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: 'test-id',
        created: 1711113008,
        model: 'mistral-small-latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Here is the info' },
                { type: 'reference', reference_ids: [1, 2, 3] },
              ],
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
      },
    };

    const { content } = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Here is the info",
          "type": "text",
        },
      ]
    `);
  });

  it('should handle reference_ids as strings', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: 'test-id',
        created: 1711113008,
        model: 'mistral-small-latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Here is the info' },
                {
                  type: 'reference',
                  reference_ids: ['ref-1', 'ref-2', 'ref-3'],
                },
              ],
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
      },
    };

    const { content } = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Here is the info",
          "type": "text",
        },
      ]
    `);
  });

  it('should handle mixed reference_ids', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        object: 'chat.completion',
        id: 'test-id',
        created: 1711113008,
        model: 'mistral-small-latest',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Here is the info' },
                { type: 'reference', reference_ids: [1, 'ref-2', 3] },
              ],
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, total_tokens: 34, completion_tokens: 30 },
      },
    };

    const { content } = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Here is the info",
          "type": "text",
        },
      ]
    `);
  });
});
