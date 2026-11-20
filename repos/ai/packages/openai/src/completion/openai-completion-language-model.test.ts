import fs from 'node:fs';

import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createOpenAI } from '../openai-provider';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const TEST_LOGPROBS = {
  tokens: [' ever', ' after', '.\n\n', 'The', ' end', '.'],
  token_logprobs: [
    -0.0664508, -0.014520033, -1.3820221, -0.7890417, -0.5323165, -0.10247037,
  ],
  top_logprobs: [
    {
      ' ever': -0.0664508,
    },
    {
      ' after': -0.014520033,
    },
    {
      '.\n\n': -1.3820221,
    },
    {
      The: -0.7890417,
    },
    {
      ' end': -0.5323165,
    },
    {
      '.': -0.10247037,
    },
  ] as Record<string, number>[],
};

const provider = createOpenAI({
  apiKey: 'test-api-key',
});

const model = provider.completion('gpt-3.5-turbo-instruct');

const server = createTestServer({
  'https://api.openai.com/v1/completions': {},
});

function prepareJsonFixtureResponse(filename: string) {
  server.urls['https://api.openai.com/v1/completions'].response = {
    type: 'json-value',
    body: JSON.parse(
      fs.readFileSync(`src/completion/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareChunksFixtureResponse(filename: string) {
  const chunks = fs
    .readFileSync(`src/completion/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => `data: ${line}\n\n`);
  chunks.push('data: [DONE]\n\n');

  server.urls['https://api.openai.com/v1/completions'].response = {
    type: 'stream-chunks',
    chunks,
  };
}

describe('doGenerate', () => {
  it('should extract text response', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [
          {
            text: 'Hello, World!',
            index: 0,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

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
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [{ text: '', index: 0, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
      },
    };

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
    prepareJsonFixtureResponse('openai-completion-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "echo": undefined,
          "frequency_penalty": undefined,
          "logit_bias": undefined,
          "logprobs": undefined,
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
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'test-id',
        object: 'text_completion',
        created: 123,
        model: 'test-model',
        choices: [{ text: '', index: 0, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect({
      id: response?.id,
      timestamp: response?.timestamp,
      modelId: response?.modelId,
    }).toStrictEqual({
      id: 'test-id',
      timestamp: new Date(123 * 1000),
      modelId: 'test-model',
    });
  });

  it('should extract logprobs', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [
          {
            text: '',
            index: 0,
            logprobs: TEST_LOGPROBS,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

    const provider = createOpenAI({ apiKey: 'test-api-key' });

    const response = await provider.completion('gpt-3.5-turbo').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          logprobs: 1,
        },
      },
    });
    expect(response.providerMetadata?.openai.logprobs).toStrictEqual(
      TEST_LOGPROBS,
    );
  });

  it('should extract finish reason', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [{ text: '', index: 0, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

    const { finishReason } = await provider
      .completion('gpt-3.5-turbo-instruct')
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
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [{ text: '', index: 0, finish_reason: 'eos' }],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

    const { finishReason } = await provider
      .completion('gpt-3.5-turbo-instruct')
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
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'json-value',
      headers: { 'test-header': 'test-value' },
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'gpt-3.5-turbo-instruct',
        choices: [{ text: '', index: 0, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "250",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should pass the model and the prompt', async () => {
    prepareJsonFixtureResponse('openai-completion-text');

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
    prepareJsonFixtureResponse('openai-completion-text');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completion('gpt-3.5-turbo-instruct').doGenerate({
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
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });
  });
});

describe('doStream', () => {
  it('should stream text deltas', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"choices":[{"text":"Hello","index":0,"logprobs":${JSON.stringify(TEST_LOGPROBS)},"finish_reason":null}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"choices":[{"text":", ","index":0,"logprobs":${JSON.stringify(TEST_LOGPROBS)},"finish_reason":null}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"choices":[{"text":"World!","index":0,"logprobs":${JSON.stringify(TEST_LOGPROBS)},"finish_reason":null}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"choices":[{"text":"","index":0,"logprobs":${JSON.stringify(TEST_LOGPROBS)},"finish_reason":"stop"}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","usage":{"prompt_tokens":10,"total_tokens":372,"completion_tokens":362},"choices":[]}\n\n`,
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
          "delta": ", ",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": "World!",
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
          "providerMetadata": {
            "openai": {
              "logprobs": {
                "token_logprobs": [
                  -0.0664508,
                  -0.014520033,
                  -1.3820221,
                  -0.7890417,
                  -0.5323165,
                  -0.10247037,
                ],
                "tokens": [
                  " ever",
                  " after",
                  ".

      ",
                  "The",
                  " end",
                  ".",
                ],
                "top_logprobs": [
                  {
                    " ever": -0.0664508,
                  },
                  {
                    " after": -0.014520033,
                  },
                  {
                    ".

      ": -1.3820221,
                  },
                  {
                    "The": -0.7890417,
                  },
                  {
                    " end": -0.5323165,
                  },
                  {
                    ".": -0.10247037,
                  },
                ],
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

  it('should throw an api error when the first stream chunk is an error', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message": "The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our ` +
          `help center at help.openai.com if you keep seeing this error.","type":"server_error","param":null,"code":null}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    await expect(
      model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      }),
    ).rejects.toMatchObject({
      message:
        'The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our help center at help.openai.com if you keep seeing this error.',
      statusCode: 500,
      isRetryable: true,
    });
  });

  it('should forward error stream parts after output has started', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"cmpl-error-after-output","object":"text_completion","created":1711363440,"choices":[{"text":"Hello","index":0,"logprobs":null,"finish_reason":null}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"error":{"message":"stream failed after output","type":"server_error","param":null,"code":null}}\n\n`,
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
          "id": "cmpl-error-after-output",
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
          "error": {
            "code": null,
            "message": "stream failed after output",
            "param": null,
            "type": "server_error",
          },
          "type": "error",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "providerMetadata": {
            "openai": {},
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
    server.urls['https://api.openai.com/v1/completions'].response = {
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
            "providerMetadata": {
              "openai": {},
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
    prepareChunksFixtureResponse('openai-completion-text');

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
          "logprobs": undefined,
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
          "stream_options": {
            "include_usage": true,
          },
          "suffix": undefined,
          "temperature": undefined,
          "top_p": undefined,
          "user": undefined,
        },
      }
    `);
  });

  it('should expose the raw response headers', async () => {
    server.urls['https://api.openai.com/v1/completions'].response = {
      type: 'stream-chunks',
      headers: { 'test-header': 'test-value' },
      chunks: [
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"choices":[{"text":"","index":0,"logprobs":null,"finish_reason":"stop"}],"model":"gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"gpt-3.5-turbo-instruct","usage":{"prompt_tokens":10,"total_tokens":372,"completion_tokens":362},"choices":[]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

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
    prepareChunksFixtureResponse('openai-completion-text');

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
        "stream_options": {
          "include_usage": true,
        },
      }
    `);
  });

  it('should pass headers', async () => {
    prepareChunksFixtureResponse('openai-completion-text');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completion('gpt-3.5-turbo-instruct').doStream({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
      includeRawChunks: false,
    });

    expect(server.calls[0].requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
      'openai-organization': 'test-organization',
      'openai-project': 'test-project',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });
});
