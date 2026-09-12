import { describe, it, expect } from 'vitest';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createOpenAICompatible } from '../openai-compatible-provider';
import { OpenAICompatibleCompletionLanguageModel } from './openai-compatible-completion-language-model';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createOpenAICompatible({
  baseURL: 'https://my.api.com/v1/',
  name: 'test-provider',
  headers: {
    Authorization: `Bearer test-api-key`,
  },
});

const model = provider.completionModel('gpt-3.5-turbo-instruct');

const server = createTestServer({
  'https://my.api.com/v1/completions': {},
});

describe('config', () => {
  it('should extract base name from provider string', () => {
    const model = new OpenAICompatibleCompletionLanguageModel('gpt-5', {
      provider: 'anthropic.beta',
      url: () => '',
      headers: () => ({}),
    });

    expect(model['providerOptionsName']).toBe('anthropic');
  });

  it('should handle provider without dot notation', () => {
    const model = new OpenAICompatibleCompletionLanguageModel('gpt-5', {
      provider: 'openai',
      url: () => '',
      headers: () => ({}),
    });

    expect(model['providerOptionsName']).toBe('openai');
  });

  it('should return empty for empty provider', () => {
    const model = new OpenAICompatibleCompletionLanguageModel(
      'gpt-5',

      {
        provider: '',
        url: () => '',
        headers: () => ({}),
      },
    );

    expect(model['providerOptionsName']).toBe('');
  });
});

describe('doGenerate', () => {
  function prepareJsonResponse({
    content = '',
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    finish_reason = 'stop',
    id = 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
    created = 1711363706,
    model = 'gpt-3.5-turbo-instruct',
    headers,
  }: {
    content?: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
    };
    finish_reason?: string;
    id?: string;
    created?: number;
    model?: string;
    headers?: Record<string, string>;
  }) {
    server.urls['https://my.api.com/v1/completions'].response = {
      type: 'json-value',
      headers,
      body: {
        id,
        object: 'text_completion',
        created,
        model,
        choices: [
          {
            text: content,
            index: 0,
            finish_reason,
          },
        ],
        usage,
      },
    };
  }

  it('should extract text response', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Hello, World!",
          "type": "text",
        },
      ]
    `);
  });

  it('should extract usage', async () => {
    prepareJsonResponse({
      usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
    });

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 20,
          "total": 20,
        },
        "outputTokens": {
          "reasoning": undefined,
          "text": 5,
          "total": 5,
        },
        "raw": {
          "completion_tokens": 5,
          "prompt_tokens": 20,
          "total_tokens": 25,
        },
      }
    `);
  });
  it('should send request body', async () => {
    prepareJsonResponse({});

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "echo": undefined,
          "frequency_penalty": undefined,
          "logit_bias": undefined,
          "max_tokens": undefined,
          "model": "gpt-3.5-turbo-instruct",
          "presence_penalty": undefined,
          "prompt": "user:
      Hello

      assistant:
      ",
          "seed": undefined,
          "stop": [
            "
      user:",
          ],
          "suffix": undefined,
          "temperature": undefined,
          "top_p": undefined,
          "user": undefined,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    prepareJsonResponse({
      id: 'test-id',
      created: 123,
      model: 'test-model',
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response).toMatchInlineSnapshot(`
      {
        "body": {
          "choices": [
            {
              "finish_reason": "stop",
              "index": 0,
              "text": "",
            },
          ],
          "created": 123,
          "id": "test-id",
          "model": "test-model",
          "object": "text_completion",
          "usage": {
            "completion_tokens": 30,
            "prompt_tokens": 4,
            "total_tokens": 34,
          },
        },
        "headers": {
          "content-length": "204",
          "content-type": "application/json",
        },
        "id": "test-id",
        "modelId": "test-model",
        "timestamp": 1970-01-01T00:02:03.000Z,
      }
    `);
  });

  it('should extract finish reason', async () => {
    prepareJsonResponse({
      finish_reason: 'stop',
    });

    const { finishReason } = await provider
      .completionModel('gpt-3.5-turbo-instruct')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "stop",
        "unified": "stop",
      }
    `);
  });

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      finish_reason: 'eos',
    });

    const { finishReason } = await provider
      .completionModel('gpt-3.5-turbo-instruct')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "eos",
        "unified": "other",
      }
    `);
  });

  it('should expose the raw response headers', async () => {
    prepareJsonResponse({
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toStrictEqual({
      // default headers:
      'content-length': '250',
      'content-type': 'application/json',

      // custom header
      'test-header': 'test-value',
    });
  });

  it('should pass the model and the prompt', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "stop": [
          "
      user:",
        ],
      }
    `);
  });

  it('should pass headers', async () => {
    prepareJsonResponse({ content: '' });

    const provider = createOpenAICompatible({
      baseURL: 'https://my.api.com/v1/',
      name: 'test-provider',
      headers: {
        Authorization: `Bearer test-api-key`,
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completionModel('gpt-3.5-turbo-instruct').doGenerate({
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
  });

  it('should include provider-specific options', async () => {
    prepareJsonResponse({ content: '' });

    await provider.completionModel('gpt-3.5-turbo-instruct').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        'test-provider': {
          someCustomOption: 'test-value',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "someCustomOption": "test-value",
        "stop": [
          "
      user:",
        ],
      }
    `);
  });

  it('should not include provider-specific options for different provider', async () => {
    prepareJsonResponse({ content: '' });

    await provider.completionModel('gpt-3.5-turbo-instruct').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        notThisProviderName: {
          someCustomOption: 'test-value',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "stop": [
          "
      user:",
        ],
      }
    `);
  });

  describe('camelCase provider options', () => {
    it('should accept camelCase provider options key for hyphenated provider name', async () => {
      prepareJsonResponse({ content: '' });

      await provider.completionModel('gpt-3.5-turbo-instruct').doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          testProvider: {
            someCustomOption: 'test-value',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'test-value',
      });
    });

    it('should prefer camelCase options over raw-name options', async () => {
      prepareJsonResponse({ content: '' });

      await provider.completionModel('gpt-3.5-turbo-instruct').doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          'test-provider': { someCustomOption: 'raw-value' },
          testProvider: { someCustomOption: 'camel-value' },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'camel-value',
      });
    });

    it('should emit deprecated warning when raw provider options key is used', async () => {
      prepareJsonResponse({ content: '' });

      const result = await provider
        .completionModel('gpt-3.5-turbo-instruct')
        .doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            'test-provider': { someCustomOption: 'test-value' },
          },
        });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "message": "Use 'testProvider' instead.",
            "setting": "providerOptions key 'test-provider'",
            "type": "deprecated",
          },
        ]
      `);
    });

    it('should not emit deprecated warning when camelCase provider options key is used', async () => {
      prepareJsonResponse({ content: '' });

      const result = await provider
        .completionModel('gpt-3.5-turbo-instruct')
        .doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            testProvider: { someCustomOption: 'test-value' },
          },
        });

      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    });
  });
});

describe('doStream', () => {
  function prepareEmptyStreamResponse(headers?: Record<string, string>) {
    server.urls['https://my.api.com/v1/completions'].response = {
      type: 'stream-chunks',
      headers,
      chunks: [
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","choices":[{"text":"","index":0,"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","usage":{"prompt_tokens":10,"completion_tokens":0,"total_tokens":10},"choices":[]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should stream text deltas', async () => {
    server.urls['https://my.api.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"model":"gpt-3.5-turbo-instruct","choices":[{"text":"Hello","index":0,"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"model":"gpt-3.5-turbo-instruct","choices":[{"text":",","index":0,"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"model":"gpt-3.5-turbo-instruct","choices":[{"text":" World!","index":0,"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","choices":[{"text":"","index":0,"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","usage":{"prompt_tokens":10,"completion_tokens":362,"total_tokens":372},"choices":[]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });
    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT",
          "modelId": "gpt-3.5-turbo-instruct",
          "timestamp": 2024-03-25T10:44:00.000Z,
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
          "delta": ",",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": " World!",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": "",
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
              "text": 362,
              "total": 362,
            },
            "raw": {
              "completion_tokens": 362,
              "prompt_tokens": 10,
              "total_tokens": 372,
            },
          },
        },
      ]
    `);
  });

  it('should handle error stream parts', async () => {
    server.urls['https://my.api.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message":"The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our help center at help.openai.com if you keep seeing this error.","type":"server_error","param":null,"code":null}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "error": {
            "code": null,
            "message": "The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our help center at help.openai.com if you keep seeing this error.",
            "param": null,
            "type": "server_error",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle unparsable stream parts', async () => {
    server.urls['https://my.api.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [`data: {unparsable}\n\n`, 'data: [DONE]\n\n'],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "error": [AI_JSONParseError: JSON parsing failed: Text: {unparsable}.
        Error message: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)],
            "type": "error",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "error",
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": undefined,
                "cacheWrite": undefined,
                "noCache": undefined,
                "total": undefined,
              },
              "outputTokens": {
                "reasoning": undefined,
                "text": undefined,
                "total": undefined,
              },
              "raw": undefined,
            },
          },
        ]
      `);
  });

  it('should send request body', async () => {
    prepareEmptyStreamResponse();

    const { request } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "echo": undefined,
          "frequency_penalty": undefined,
          "logit_bias": undefined,
          "max_tokens": undefined,
          "model": "gpt-3.5-turbo-instruct",
          "presence_penalty": undefined,
          "prompt": "user:
      Hello

      assistant:
      ",
          "seed": undefined,
          "stop": [
            "
      user:",
          ],
          "stream": true,
          "stream_options": undefined,
          "suffix": undefined,
          "temperature": undefined,
          "top_p": undefined,
          "user": undefined,
        },
      }
    `);
  });

  it('should expose the raw response headers', async () => {
    prepareEmptyStreamResponse({ 'test-header': 'test-value' });

    const { response } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(response?.headers).toStrictEqual({
      // default headers:
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',

      // custom header
      'test-header': 'test-value',
    });
  });

  it('should pass the model and the prompt', async () => {
    prepareEmptyStreamResponse();

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "stop": [
          "
      user:",
        ],
        "stream": true,
      }
    `);
  });

  it('should pass headers', async () => {
    prepareEmptyStreamResponse();

    const provider = createOpenAICompatible({
      baseURL: 'https://my.api.com/v1/',
      name: 'test-provider',
      headers: {
        Authorization: `Bearer test-api-key`,
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completionModel('gpt-3.5-turbo-instruct').doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
  });

  it('should include provider-specific options', async () => {
    prepareEmptyStreamResponse();

    await model.doStream({
      providerOptions: {
        'test-provider': {
          someCustomOption: 'test-value',
        },
      },
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "someCustomOption": "test-value",
        "stop": [
          "
      user:",
        ],
        "stream": true,
      }
    `);
  });

  it('should not include provider-specific options for different provider', async () => {
    prepareEmptyStreamResponse();

    await model.doStream({
      providerOptions: {
        notThisProviderName: {
          someCustomOption: 'test-value',
        },
      },
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "model": "gpt-3.5-turbo-instruct",
        "prompt": "user:
      Hello

      assistant:
      ",
        "stop": [
          "
      user:",
        ],
        "stream": true,
      }
    `);
  });

  describe('camelCase provider options', () => {
    it('should accept camelCase provider options key for hyphenated provider name', async () => {
      prepareEmptyStreamResponse();

      await model.doStream({
        providerOptions: {
          testProvider: {
            someCustomOption: 'test-value',
          },
        },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'test-value',
      });
    });

    it('should prefer camelCase options over raw-name options', async () => {
      prepareEmptyStreamResponse();

      await model.doStream({
        providerOptions: {
          'test-provider': { someCustomOption: 'raw-value' },
          testProvider: { someCustomOption: 'camel-value' },
        },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'camel-value',
      });
    });
  });
});
