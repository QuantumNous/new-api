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
  content: [
    {
      token: 'Hello',
      logprob: -0.0009994634,
      top_logprobs: [
        {
          token: 'Hello',
          logprob: -0.0009994634,
        },
      ],
    },
    {
      token: '!',
      logprob: -0.13410144,
      top_logprobs: [
        {
          token: '!',
          logprob: -0.13410144,
        },
      ],
    },
    {
      token: ' How',
      logprob: -0.0009250381,
      top_logprobs: [
        {
          token: ' How',
          logprob: -0.0009250381,
        },
      ],
    },
    {
      token: ' can',
      logprob: -0.047709424,
      top_logprobs: [
        {
          token: ' can',
          logprob: -0.047709424,
        },
      ],
    },
    {
      token: ' I',
      logprob: -0.000009014684,
      top_logprobs: [
        {
          token: ' I',
          logprob: -0.000009014684,
        },
      ],
    },
    {
      token: ' assist',
      logprob: -0.009125131,
      top_logprobs: [
        {
          token: ' assist',
          logprob: -0.009125131,
        },
      ],
    },
    {
      token: ' you',
      logprob: -0.0000066306106,
      top_logprobs: [
        {
          token: ' you',
          logprob: -0.0000066306106,
        },
      ],
    },
    {
      token: ' today',
      logprob: -0.00011093382,
      top_logprobs: [
        {
          token: ' today',
          logprob: -0.00011093382,
        },
      ],
    },
    {
      token: '?',
      logprob: -0.00004596782,
      top_logprobs: [
        {
          token: '?',
          logprob: -0.00004596782,
        },
      ],
    },
  ],
};

const provider = createOpenAI({
  apiKey: 'test-api-key',
});

const model = provider.chat('gpt-3.5-turbo');

const server = createTestServer({
  'https://api.openai.com/v1/chat/completions': {},
});

function prepareChunksFixtureResponse(filename: string) {
  const chunks = fs
    .readFileSync(`src/chat/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => `data: ${line}\n\n`);
  chunks.push('data: [DONE]\n\n');

  server.urls['https://api.openai.com/v1/chat/completions'].response = {
    type: 'stream-chunks',
    chunks,
  };
}

function prepareJsonFixtureResponse(filename: string) {
  server.urls['https://api.openai.com/v1/chat/completions'].response = {
    type: 'json-value',
    body: JSON.parse(
      fs.readFileSync(`src/chat/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doGenerate', () => {
  it('should extract text response', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, World!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "Hello, World!",
          "type": "text",
        },
      ]
    `);
  });

  it('should extract usage', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 20,
          "total": 20,
        },
        "outputTokens": {
          "reasoning": 0,
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
    prepareJsonFixtureResponse('openai-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "frequency_penalty": undefined,
          "logit_bias": undefined,
          "logprobs": undefined,
          "max_completion_tokens": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "metadata": undefined,
          "model": "gpt-3.5-turbo",
          "parallel_tool_calls": undefined,
          "prediction": undefined,
          "presence_penalty": undefined,
          "prompt_cache_key": undefined,
          "prompt_cache_options": undefined,
          "prompt_cache_retention": undefined,
          "reasoning_effort": undefined,
          "response_format": undefined,
          "safety_identifier": undefined,
          "seed": undefined,
          "service_tier": undefined,
          "stop": undefined,
          "store": undefined,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_logprobs": undefined,
          "top_p": undefined,
          "user": undefined,
          "verbosity": undefined,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'test-id',
        object: 'chat.completion',
        created: 123,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

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
              "message": {
                "content": "",
                "role": "assistant",
              },
            },
          ],
          "created": 123,
          "id": "test-id",
          "model": "test-model",
          "object": "chat.completion",
          "system_fingerprint": "fp_3bc1b5746c",
          "usage": {
            "completion_tokens": 30,
            "prompt_tokens": 4,
            "total_tokens": 34,
          },
        },
        "headers": {
          "content-length": "275",
          "content-type": "application/json",
        },
        "id": "test-id",
        "modelId": "test-model",
        "timestamp": 1970-01-01T00:02:03.000Z,
      }
    `);
  });

  it('should support partial usage', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, total_tokens: 20 },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 20,
          "total": 20,
        },
        "outputTokens": {
          "reasoning": 0,
          "text": 0,
          "total": 0,
        },
        "raw": {
          "prompt_tokens": 20,
          "total_tokens": 20,
        },
      }
    `);
  });

  it('should extract logprobs', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            logprobs: TEST_LOGPROBS,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const response = await provider.chat('gpt-3.5-turbo').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          logprobs: 1,
        },
      },
    });
    expect(response.providerMetadata?.openai.logprobs).toStrictEqual(
      TEST_LOGPROBS.content,
    );
  });

  it('should extract finish reason', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "stop",
        "unified": "stop",
      }
    `);
  });

  it('should support unknown finish reason', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'eos',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "eos",
        "unified": "other",
      }
    `);
  });

  it('should expose the raw response headers', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      headers: { 'test-header': 'test-value' },
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "321",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should pass the model and the messages', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass settings', async () => {
    prepareJsonFixtureResponse('openai-text');

    await provider.chat('gpt-3.5-turbo').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          logitBias: { 50256: -100 },
          parallelToolCalls: false,
          user: 'test-user-id',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "logit_bias": {
          "50256": -100,
        },
        "messages": [
          {
            "content": "Hello",
            "role": "user",
          },
        ],
        "model": "gpt-3.5-turbo",
        "parallel_tool_calls": false,
        "user": "test-user-id",
      }
    `);
  });

  it('should not set reasoning_effort when reasoning is "provider-default"', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      reasoning: 'provider-default',
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass top-level reasoning as reasoning_effort', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      reasoning: 'medium',
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'medium',
    });
  });

  it('should prefer providerOptions reasoningEffort over top-level reasoning', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      reasoning: 'medium',
      providerOptions: {
        openai: { reasoningEffort: 'high' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'high',
    });
  });

  it('should pass reasoningEffort setting from provider metadata', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: { reasoningEffort: 'low' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'low',
    });
  });

  it('should pass reasoningEffort setting from settings', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: { reasoningEffort: 'high' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'high',
    });
  });

  it('should pass reasoningEffort xhigh setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-5.1-codex-max');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: { reasoningEffort: 'xhigh' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-5.1-codex-max',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'xhigh',
    });
  });

  it('should pass reasoningEffort max setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-5.6');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: { reasoningEffort: 'max' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-5.6',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'max',
    });
  });

  it('should pass textVerbosity setting from provider options', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: { textVerbosity: 'low' },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      verbosity: 'low',
    });
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonFixtureResponse('openai-text');

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
        "model": "gpt-3.5-turbo",
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
    prepareJsonFixtureResponse('openai-text');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('gpt-3.5-turbo').doGenerate({
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
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/openai/0.0.0-test`,
    );
  });

  it('should parse tool results', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                  type: 'function',
                  function: {
                    name: 'test-tool',
                    arguments: '{"value":"Spark"}',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

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
      toolChoice: {
        type: 'tool',
        toolName: 'test-tool',
      },
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"value":"Spark"}",
          "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-call",
        },
      ]
    `);
  });

  it('should parse annotations/citations', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                'Based on the search results [doc1], I found information.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    start_index: 24,
                    end_index: 29,
                    url: 'https://example.com/doc1.pdf',
                    title: 'Document 1',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toEqual([
      {
        text: 'Based on the search results [doc1], I found information.',
        type: 'text',
      },
      {
        id: expect.any(String),
        sourceType: 'url',
        title: 'Document 1',
        type: 'source',
        url: 'https://example.com/doc1.pdf',
      },
    ]);
  });

  describe('response format', () => {
    it('should not send a response_format when response format is text', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'text' },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'gpt-4o-2024-08-06',
        messages: [{ role: 'user', content: 'Hello' }],
      });
    });

    it('should forward json response format as "json_object" without schema', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'json' },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'gpt-4o-2024-08-06',
        messages: [{ role: 'user', content: 'Hello' }],
        response_format: { type: 'json_object' },
      });
    });

    it('should forward json response format as "json_object" and include schema', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      const { warnings } = await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
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
          "model": "gpt-4o-2024-08-06",
          "response_format": {
            "json_schema": {
              "name": "response",
              "schema": {
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
              "strict": true,
            },
            "type": "json_schema",
          },
        }
      `);

      expect(warnings).toEqual([]);
    });

    it('should use json_schema & strict with responseFormat json', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      await model.doGenerate({
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
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
          "model": "gpt-4o-2024-08-06",
          "response_format": {
            "json_schema": {
              "name": "response",
              "schema": {
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
              "strict": true,
            },
            "type": "json_schema",
          },
        }
      `);
    });

    it('should set name & description with responseFormat json', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      await model.doGenerate({
        responseFormat: {
          type: 'json',
          name: 'test-name',
          description: 'test description',
          schema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
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
          "model": "gpt-4o-2024-08-06",
          "response_format": {
            "json_schema": {
              "description": "test description",
              "name": "test-name",
              "schema": {
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
              "strict": true,
            },
            "type": "json_schema",
          },
        }
      `);
    });

    it('should allow for undefined schema with responseFormat json when structuredOutputs are enabled', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-4o-2024-08-06');

      await model.doGenerate({
        responseFormat: {
          type: 'json',
          name: 'test-name',
          description: 'test description',
        },
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'gpt-4o-2024-08-06',
        messages: [{ role: 'user', content: 'Hello' }],
        response_format: {
          type: 'json_object',
        },
      });
    });

    it('should set strict with tool call', async () => {
      server.urls['https://api.openai.com/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
          object: 'chat.completion',
          created: 1711115037,
          model: 'gpt-3.5-turbo-0125',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '',
                tool_calls: [
                  {
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    type: 'function',
                    function: {
                      name: 'test-tool',
                      arguments: '{"value":"Spark"}',
                    },
                  },
                ],
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 4,
            total_tokens: 34,
            completion_tokens: 30,
          },
          system_fingerprint: 'fp_3bc1b5746c',
        },
      };

      const model = provider.chat('gpt-4o-2024-08-06');

      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            description: 'test description',
            inputSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        toolChoice: { type: 'required' },
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
          "model": "gpt-4o-2024-08-06",
          "tool_choice": "required",
          "tools": [
            {
              "function": {
                "description": "test description",
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

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"value":"Spark"}",
            "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "toolName": "test-tool",
            "type": "tool-call",
          },
        ]
      `);
    });
  });

  it('should set strict for tool usage', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                  type: 'function',
                  function: {
                    name: 'test-tool',
                    arguments: '{"value":"Spark"}',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const model = provider.chat('gpt-4o-2024-08-06');

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
        "model": "gpt-4o-2024-08-06",
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

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"value":"Spark"}",
          "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-call",
        },
      ]
    `);
  });

  it('should return cached_tokens in prompt_details_tokens', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 2000,
          completion_tokens: 20,
          total_tokens: 2020,
          prompt_tokens_details: {
            cached_tokens: 1152,
            cache_write_tokens: 256,
          },
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const model = provider.chat('gpt-4o-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 1152,
          "cacheWrite": 256,
          "noCache": 592,
          "total": 2000,
        },
        "outputTokens": {
          "reasoning": 0,
          "text": 20,
          "total": 20,
        },
        "raw": {
          "completion_tokens": 20,
          "prompt_tokens": 2000,
          "prompt_tokens_details": {
            "cache_write_tokens": 256,
            "cached_tokens": 1152,
          },
          "total_tokens": 2020,
        },
      }
    `);
  });

  it('should return accepted_prediction_tokens and rejected_prediction_tokens in completion_details_tokens', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 20,
          total_tokens: 35,
          completion_tokens_details: {
            accepted_prediction_tokens: 123,
            rejected_prediction_tokens: 456,
          },
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const model = provider.chat('gpt-4o-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.providerMetadata).toStrictEqual({
      openai: {
        acceptedPredictionTokens: 123,
        rejectedPredictionTokens: 456,
      },
    });
  });

  describe('reasoning models', () => {
    it('should clear out temperature, top_p, frequency_penalty, presence_penalty and return warnings', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('o4-mini');

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        temperature: 0.5,
        topP: 0.7,
        frequencyPenalty: 0.2,
        presencePenalty: 0.3,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'o4-mini',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "temperature is not supported for reasoning models",
            "feature": "temperature",
            "type": "unsupported",
          },
          {
            "details": "topP is not supported for reasoning models",
            "feature": "topP",
            "type": "unsupported",
          },
          {
            "details": "frequencyPenalty is not supported for reasoning models",
            "feature": "frequencyPenalty",
            "type": "unsupported",
          },
          {
            "details": "presencePenalty is not supported for reasoning models",
            "feature": "presencePenalty",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should convert maxOutputTokens to max_completion_tokens', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('o4-mini');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        maxOutputTokens: 1000,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'o4-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_completion_tokens: 1000,
      });
    });

    it('should allow temperature when top-level reasoning is none on gpt-5.1', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('gpt-5.1');

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
        temperature: 0.5,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'gpt-5.1',
        messages: [{ role: 'user', content: 'Hello' }],
        reasoning_effort: 'none',
        temperature: 0.5,
      });

      expect(result.warnings).toStrictEqual([]);
    });

    it('should still clear temperature when top-level reasoning is none on o4-mini', async () => {
      prepareJsonFixtureResponse('openai-text');

      const model = provider.chat('o4-mini');

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
        temperature: 0.5,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'o4-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        reasoning_effort: 'none',
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "temperature is not supported for reasoning models",
            "feature": "temperature",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  it('should allow forcing reasoning behavior for unrecognized model IDs via providerOptions', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('stealth-reasoning-model');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 0.5,
      topP: 0.7,
      providerOptions: {
        openai: {
          forceReasoning: true,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'stealth-reasoning-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "temperature is not supported for reasoning models",
          "feature": "temperature",
          "type": "unsupported",
        },
        {
          "details": "topP is not supported for reasoning models",
          "feature": "topP",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should default systemMessageMode to developer when forcing reasoning', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('stealth-reasoning-model');

    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      providerOptions: {
        openai: {
          forceReasoning: true,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'stealth-reasoning-model',
      messages: [
        { role: 'developer', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.warnings).toStrictEqual([]);
  });

  it('should use developer messages for o1', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o1');

    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o1',
      messages: [
        { role: 'developer', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.warnings).toStrictEqual([]);
  });

  it('should allow overriding systemMessageMode via providerOptions', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o');

    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      providerOptions: {
        openai: {
          systemMessageMode: 'developer',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-4o',
      messages: [
        { role: 'developer', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.warnings).toStrictEqual([]);
  });

  it('should use default systemMessageMode when not overridden', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o');

    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.warnings).toStrictEqual([]);
  });

  it('should return the reasoning tokens in the provider metadata', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 20,
          total_tokens: 35,
          completion_tokens_details: {
            reasoning_tokens: 10,
          },
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const model = provider.chat('o4-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 15,
          "total": 15,
        },
        "outputTokens": {
          "reasoning": 10,
          "text": 10,
          "total": 20,
        },
        "raw": {
          "completion_tokens": 20,
          "completion_tokens_details": {
            "reasoning_tokens": 10,
          },
          "prompt_tokens": 15,
          "total_tokens": 35,
        },
      }
    `);
  });

  it('should send max_completion_tokens extension setting', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'o4-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          maxCompletionTokens: 255,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'o4-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 255,
    });
  });

  it('should send prediction extension setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          prediction: {
            type: 'content',
            content: 'Hello, World!',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      prediction: {
        type: 'content',
        content: 'Hello, World!',
      },
    });
  });

  it('should send store extension setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          store: true,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      store: true,
    });
  });

  it('should send metadata extension values', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          metadata: {
            custom: 'value',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: {
        custom: 'value',
      },
    });
  });

  it('should send promptCacheKey extension value', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          promptCacheKey: 'test-cache-key-123',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      prompt_cache_key: 'test-cache-key-123',
    });
  });

  it('should send promptCacheRetention extension value', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          promptCacheRetention: '24h',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      prompt_cache_retention: '24h',
    });
  });

  it('should send promptCacheOptions extension value', async () => {
    prepareJsonFixtureResponse('openai-text');

    await provider.chat('gpt-5.6').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          promptCacheOptions: {
            mode: 'explicit',
            ttl: '30m',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-5.6',
      messages: [{ role: 'user', content: 'Hello' }],
      prompt_cache_options: {
        mode: 'explicit',
        ttl: '30m',
      },
    });
  });

  it('should send safetyIdentifier extension value', async () => {
    prepareJsonFixtureResponse('openai-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          safetyIdentifier: 'test-safety-identifier-123',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      safety_identifier: 'test-safety-identifier-123',
    });
  });

  it('should remove temperature setting for gpt-4o-search-preview and add warning', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-search-preview');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 0.7,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.model).toBe('gpt-4o-search-preview');
    expect(requestBody.temperature).toBeUndefined();

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "temperature is not supported for the search preview models and has been removed.",
          "feature": "temperature",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should remove temperature setting for gpt-4o-mini-search-preview and add warning', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-mini-search-preview');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 0.7,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.model).toBe('gpt-4o-mini-search-preview');
    expect(requestBody.temperature).toBeUndefined();

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "temperature is not supported for the search preview models and has been removed.",
          "feature": "temperature",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should remove temperature setting for gpt-4o-mini-search-preview-2025-03-11 and add warning', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-mini-search-preview-2025-03-11');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 0.7,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.model).toBe('gpt-4o-mini-search-preview-2025-03-11');
    expect(requestBody.temperature).toBeUndefined();

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "temperature is not supported for the search preview models and has been removed.",
          "feature": "temperature",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should send serviceTier flex processing setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'flex',
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
        "model": "o4-mini",
        "service_tier": "flex",
      }
    `);
  });

  it('should show warning when using flex processing with unsupported model', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'flex',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.service_tier).toBeUndefined();

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "flex processing is only available for o3, o4-mini, and gpt-5 models",
          "feature": "serviceTier",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should allow flex processing with o4-mini model without warnings', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'flex',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.service_tier).toBe('flex');
    expect(result.warnings).toEqual([]);
  });

  it('should send serviceTier priority processing setting', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-mini');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'priority',
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
        "model": "gpt-4o-mini",
        "service_tier": "priority",
      }
    `);
  });

  it('should show warning when using priority processing with unsupported model', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-3.5-turbo');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'priority',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.service_tier).toBeUndefined();

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported",
          "feature": "serviceTier",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should allow priority processing with gpt-4o model without warnings', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'priority',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.service_tier).toBe('priority');
    expect(result.warnings).toEqual([]);
  });

  it('should allow priority processing with o3 model without warnings', async () => {
    prepareJsonFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'priority',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.service_tier).toBe('priority');
    expect(result.warnings).toEqual([]);
  });
});

describe('doStream', () => {
  it('should stream text after Azure content filter chunks', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"choices":[],"created":0,"id":"","model":"","object":"","prompt_filter_results":[{"prompt_index":0,"content_filter_results":{}}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"","role":"assistant"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        `data: {"choices":[{"content_filter_offsets":{},"content_filter_results":{},"finish_reason":null,"index":0}],"created":0,"id":"","model":"","object":""}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);

    expect(events.filter(event => event.type === 'text-delta')).toStrictEqual([
      { type: 'text-delta', id: '0', delta: '' },
      { type: 'text-delta', id: '0', delta: 'Hello' },
    ]);
  });

  it('should stream text deltas', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":", "},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"World!"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":${JSON.stringify(TEST_LOGPROBS)}}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"total_tokens":244,"completion_tokens":227}}\n\n`,
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
          "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
          "modelId": "gpt-3.5-turbo-0613",
          "timestamp": 2023-12-15T16:17:00.000Z,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "",
          "id": "0",
          "type": "text-delta",
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
              "logprobs": [
                {
                  "logprob": -0.0009994634,
                  "token": "Hello",
                  "top_logprobs": [
                    {
                      "logprob": -0.0009994634,
                      "token": "Hello",
                    },
                  ],
                },
                {
                  "logprob": -0.13410144,
                  "token": "!",
                  "top_logprobs": [
                    {
                      "logprob": -0.13410144,
                      "token": "!",
                    },
                  ],
                },
                {
                  "logprob": -0.0009250381,
                  "token": " How",
                  "top_logprobs": [
                    {
                      "logprob": -0.0009250381,
                      "token": " How",
                    },
                  ],
                },
                {
                  "logprob": -0.047709424,
                  "token": " can",
                  "top_logprobs": [
                    {
                      "logprob": -0.047709424,
                      "token": " can",
                    },
                  ],
                },
                {
                  "logprob": -0.000009014684,
                  "token": " I",
                  "top_logprobs": [
                    {
                      "logprob": -0.000009014684,
                      "token": " I",
                    },
                  ],
                },
                {
                  "logprob": -0.009125131,
                  "token": " assist",
                  "top_logprobs": [
                    {
                      "logprob": -0.009125131,
                      "token": " assist",
                    },
                  ],
                },
                {
                  "logprob": -0.0000066306106,
                  "token": " you",
                  "top_logprobs": [
                    {
                      "logprob": -0.0000066306106,
                      "token": " you",
                    },
                  ],
                },
                {
                  "logprob": -0.00011093382,
                  "token": " today",
                  "top_logprobs": [
                    {
                      "logprob": -0.00011093382,
                      "token": " today",
                    },
                  ],
                },
                {
                  "logprob": -0.00004596782,
                  "token": "?",
                  "top_logprobs": [
                    {
                      "logprob": -0.00004596782,
                      "token": "?",
                    },
                  ],
                },
              ],
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 17,
              "total": 17,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 227,
              "total": 227,
            },
            "raw": {
              "completion_tokens": 227,
              "prompt_tokens": 17,
              "total_tokens": 244,
            },
          },
        },
      ]
    `);
  });

  it('should stream annotations/citations', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Based on search results"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":null,"choices":[{"index":1,"delta":{"annotations":[{"type":"url_citation","url_citation":{"start_index":24,"end_index":29,"url":"https://example.com/doc1.pdf","title":"Document 1"}}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"completion_tokens":227,"total_tokens":244}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const streamResult = await convertReadableStreamToArray(stream);

    expect(streamResult).toEqual(
      expect.arrayContaining([
        { type: 'stream-start', warnings: [] },
        expect.objectContaining({
          type: 'response-metadata',
          id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
        }),
        { type: 'text-start', id: '0' },
        { type: 'text-delta', id: '0', delta: '' },
        { type: 'text-delta', id: '0', delta: 'Based on search results' },
        {
          type: 'source',
          sourceType: 'url',
          id: expect.any(String),
          url: 'https://example.com/doc1.pdf',
          title: 'Document 1',
        },
        { type: 'text-end', id: '0' },
        expect.objectContaining({
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
        }),
      ]),
    );
  });

  it('should stream tool deltas', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"value"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
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
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
          "modelId": "gpt-3.5-turbo-0125",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "value",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "":"",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "Spark",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "le",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": " Day",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": ""}",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-end",
        },
        {
          "input": "{"value":"Sparkle Day"}",
          "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "tool-calls",
          },
          "providerMetadata": {
            "openai": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 53,
              "total": 53,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 17,
              "total": 17,
            },
            "raw": {
              "completion_tokens": 17,
              "prompt_tokens": 53,
              "total_tokens": 70,
            },
          },
        },
      ]
    `);
  });

  it('should stream tool call deltas when tool call arguments are passed in the first chunk', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"va"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"lue"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
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
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
          "modelId": "gpt-3.5-turbo-0125",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "va",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "lue",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "":"",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "Spark",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": "le",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": " Day",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "delta": ""}",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-end",
        },
        {
          "input": "{"value":"Sparkle Day"}",
          "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "tool-calls",
          },
          "providerMetadata": {
            "openai": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 53,
              "total": 53,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 17,
              "total": 17,
            },
            "raw": {
              "completion_tokens": 17,
              "prompt_tokens": 53,
              "total_tokens": 70,
            },
          },
        },
      ]
    `);
  });

  it('should not duplicate tool calls when there is an additional empty chunk after the tool call has been completed', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":226,"completion_tokens":0}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"id":"chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",` +
          `"type":"function","index":0,"function":{"name":"searchGoogle"}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":233,"completion_tokens":7}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":"{\\"query\\": \\""}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":241,"completion_tokens":15}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":"latest"}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":242,"completion_tokens":16}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":" news"}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":243,"completion_tokens":17}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":" on"}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":244,"completion_tokens":18}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":" ai\\"}"}}]},"logprobs":null,"finish_reason":null}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":245,"completion_tokens":19}}\n\n`,
        // empty arguments chunk after the tool call has already been finished:
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":""}}]},"logprobs":null,"finish_reason":"tool_calls","stop_reason":128008}],` +
          `"usage":{"prompt_tokens":226,"total_tokens":246,"completion_tokens":20}}\n\n`,
        `data: {"id":"chat-2267f7e2910a4254bac0650ba74cfc1c","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"meta/llama-3.1-8b-instruct:fp8","choices":[],` +
          `"usage":{"prompt_tokens":226,"total_tokens":246,"completion_tokens":20}}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'searchGoogle',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
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
          "id": "chat-2267f7e2910a4254bac0650ba74cfc1c",
          "modelId": "meta/llama-3.1-8b-instruct:fp8",
          "timestamp": 2024-12-02T17:57:21.000Z,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "toolName": "searchGoogle",
          "type": "tool-input-start",
        },
        {
          "delta": "{"query": "",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "delta": "latest",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "delta": " news",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "delta": " on",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "delta": " ai"}",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "delta": "",
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "id": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "type": "tool-input-end",
        },
        {
          "input": "{"query": "latest news on ai"}",
          "toolCallId": "chatcmpl-tool-b3b307239370432d9910d4b79b4dbbaa",
          "toolName": "searchGoogle",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "tool-calls",
          },
          "providerMetadata": {
            "openai": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 226,
              "total": 226,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 20,
              "total": 20,
            },
            "raw": {
              "completion_tokens": 20,
              "prompt_tokens": 226,
              "total_tokens": 246,
            },
          },
        },
      ]
    `);
  });

  it('should not finalize tool call early when partial JSON is coincidentally parsable', async () => {
    // Regression test: if streamed tool call arguments form valid JSON before
    // all chunks have arrived, the tool call must NOT be finalized early.
    // For example, {"query": "test"} is valid JSON but the full args are
    // {"query": "test", "limit": 10}. Finalizing early would lose "limit".
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        // initial chunk with tool call start
        `data: {"id":"chatcmpl-early","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_early123","type":"function",` +
          `"function":{"name":"search","arguments":""}}]},"finish_reason":null}]}\n\n`,
        // This chunk produces valid JSON: {"query": "test"}
        `data: {"id":"chatcmpl-early","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":"{\\"query\\": \\"test\\"}"}}]},"finish_reason":null}]}\n\n`,
        // More data arrives - the full args include "limit"
        `data: {"id":"chatcmpl-early","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":""}}]},"finish_reason":null}]}\n\n`,
        // Even more data: adding the comma and limit field
        `data: {"id":"chatcmpl-early","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,` +
          `"function":{"arguments":", \\"limit\\": 10}"}}]},"finish_reason":null}]}\n\n`,
        // finish
        `data: {"id":"chatcmpl-early","object":"chat.completion.chunk","created":1733162241,` +
          `"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'search',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['query'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Find the tool-call event
    const toolCallEvent = result.find(
      (e: { type: string }) => e.type === 'tool-call',
    );

    // The tool call must contain the COMPLETE arguments, not just the
    // partial JSON that happened to be parsable mid-stream.
    expect(toolCallEvent).toEqual({
      type: 'tool-call',
      toolCallId: 'call_early123',
      toolName: 'search',
      input: '{"query": "test"}, "limit": 10}',
    });

    // Verify there is exactly one tool-call event (no premature duplicate)
    const toolCallEvents = result.filter(
      (e: { type: string }) => e.type === 'tool-call',
    );
    expect(toolCallEvents).toHaveLength(1);
  });

  it('should stream tool call with missing type field (Azure AI Foundry / Mistral)', async () => {
    // Azure AI Foundry and Mistral omit the `type` field in streaming tool call deltas.
    // The parser should accept null/undefined type as equivalent to "function".
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-azure-001","object":"chat.completion.chunk","created":1711357598,"model":"mistral-large",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_abc123","function":{"name":"test-tool","arguments":""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-azure-001","object":"chat.completion.chunk","created":1711357598,"model":"mistral-large",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"value\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-azure-001","object":"chat.completion.chunk","created":1711357598,"model":"mistral-large",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"hello\\"}"}}]},` +
          `"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        `data: [DONE]\n\n`,
      ],
    };

    const { stream } = await model.doStream({
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
      includeRawChunks: false,
    });

    const chunks = await convertReadableStreamToArray(stream);
    const toolInputStart = chunks.find(c => c.type === 'tool-input-start');
    const toolCall = chunks.find(c => c.type === 'tool-call');

    expect(toolInputStart).toMatchObject({
      type: 'tool-input-start',
      id: 'call_abc123',
      toolName: 'test-tool',
    });
    expect(toolCall).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call_abc123',
      toolName: 'test-tool',
      input: '{"value":"hello"}',
    });
  });

  it('should stream tool call that is sent in one chunk', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\"value\\":\\"Sparkle Day\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
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
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
          "modelId": "gpt-3.5-turbo-0125",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"value":"Sparkle Day"}",
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-delta",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-end",
        },
        {
          "input": "{"value":"Sparkle Day"}",
          "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "tool-calls",
          },
          "providerMetadata": {
            "openai": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 53,
              "total": 53,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 17,
              "total": 17,
            },
            "raw": {
              "completion_tokens": 17,
              "prompt_tokens": 53,
              "total_tokens": 70,
            },
          },
        },
      ]
    `);
  });

  it('should throw an api error when the first stream chunk is an error', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
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

  it('should preserve numeric status codes from early stream errors', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message":"bad request","type":"provider_error","param":null,"code":400}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    await expect(
      model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      }),
    ).rejects.toMatchObject({
      message: 'bad request',
      statusCode: 400,
      isRetryable: false,
    });
  });

  it('should forward error stream parts after output has started', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-error-after-output","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n`,
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
          "id": "chatcmpl-error-after-output",
          "modelId": "gpt-3.5-turbo-0613",
          "timestamp": 2023-12-15T16:17:00.000Z,
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
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
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
    prepareChunksFixtureResponse('openai-text');

    const { request } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "frequency_penalty": undefined,
          "logit_bias": undefined,
          "logprobs": undefined,
          "max_completion_tokens": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "metadata": undefined,
          "model": "gpt-3.5-turbo",
          "parallel_tool_calls": undefined,
          "prediction": undefined,
          "presence_penalty": undefined,
          "prompt_cache_key": undefined,
          "prompt_cache_options": undefined,
          "prompt_cache_retention": undefined,
          "reasoning_effort": undefined,
          "response_format": undefined,
          "safety_identifier": undefined,
          "seed": undefined,
          "service_tier": undefined,
          "stop": undefined,
          "store": undefined,
          "stream": true,
          "stream_options": {
            "include_usage": true,
          },
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_logprobs": undefined,
          "top_p": undefined,
          "user": undefined,
          "verbosity": undefined,
        },
      }
    `);
  });

  it('should expose the raw response headers', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      headers: { 'test-header': 'test-value' },
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"total_tokens":244,"completion_tokens":227}}\n\n`,
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

  it('should pass the messages and the model', async () => {
    prepareChunksFixtureResponse('openai-text');

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass headers', async () => {
    prepareChunksFixtureResponse('openai-text');

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-organization',
      project: 'test-project',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('gpt-3.5-turbo').doStream({
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
  });

  it('should return cached tokens in providerMetadata', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":2000,"completion_tokens":20,"total_tokens":2020,"prompt_tokens_details":{"cached_tokens":1152,"cache_write_tokens":256}}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect((await convertReadableStreamToArray(stream)).at(-1))
      .toMatchInlineSnapshot(`
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "openai": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 1152,
              "cacheWrite": 256,
              "noCache": 592,
              "total": 2000,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 20,
              "total": 20,
            },
            "raw": {
              "completion_tokens": 20,
              "prompt_tokens": 2000,
              "prompt_tokens_details": {
                "cache_write_tokens": 256,
                "cached_tokens": 1152,
              },
              "total_tokens": 2020,
            },
          },
        }
      `);
  });

  it('should return accepted_prediction_tokens and rejected_prediction_tokens in providerMetadata', async () => {
    server.urls['https://api.openai.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":15,"completion_tokens":20,"total_tokens":35,"completion_tokens_details":{"accepted_prediction_tokens":123,"rejected_prediction_tokens":456}}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect((await convertReadableStreamToArray(stream)).at(-1))
      .toMatchInlineSnapshot(`
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "openai": {
              "acceptedPredictionTokens": 123,
              "rejectedPredictionTokens": 456,
            },
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
              "reasoning": 0,
              "text": 20,
              "total": 20,
            },
            "raw": {
              "completion_tokens": 20,
              "completion_tokens_details": {
                "accepted_prediction_tokens": 123,
                "rejected_prediction_tokens": 456,
              },
              "prompt_tokens": 15,
              "total_tokens": 35,
            },
          },
        }
      `);
  });

  it('should send store extension setting', async () => {
    prepareChunksFixtureResponse('openai-text');

    await model.doStream({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          store: true,
        },
      },
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: 'user', content: 'Hello' }],
      store: true,
    });
  });

  it('should send metadata extension values', async () => {
    prepareChunksFixtureResponse('openai-text');

    await model.doStream({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          metadata: {
            custom: 'value',
          },
        },
      },
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      model: 'gpt-3.5-turbo',
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: {
        custom: 'value',
      },
    });
  });

  it('should send serviceTier flex processing setting in streaming', async () => {
    prepareChunksFixtureResponse('openai-text');

    const model = provider.chat('o4-mini');

    await model.doStream({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'flex',
        },
      },
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
        "model": "o4-mini",
        "service_tier": "flex",
        "stream": true,
        "stream_options": {
          "include_usage": true,
        },
      }
    `);
  });

  it('should send serviceTier priority processing setting in streaming', async () => {
    prepareChunksFixtureResponse('openai-text');

    const model = provider.chat('gpt-4o-mini');

    await model.doStream({
      prompt: TEST_PROMPT,
      providerOptions: {
        openai: {
          serviceTier: 'priority',
        },
      },
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
        "model": "gpt-4o-mini",
        "service_tier": "priority",
        "stream": true,
        "stream_options": {
          "include_usage": true,
        },
      }
    `);
  });

  it('should set .modelId for model-router request', async () => {
    prepareChunksFixtureResponse('azure-model-router.1');

    const result = await provider.chat('test-azure-model-router').doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(result.stream)).toMatchSnapshot();
  });

  describe('reasoning models', () => {
    it('should stream text delta', async () => {
      server.urls['https://api.openai.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Hello, World!"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"total_tokens":244,"completion_tokens":227}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const model = provider.chat('o4-mini');

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
            "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
            "modelId": "o4-mini",
            "timestamp": 2023-12-15T16:17:00.000Z,
            "type": "response-metadata",
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "delta": "",
            "id": "0",
            "type": "text-delta",
          },
          {
            "delta": "Hello, World!",
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
              "openai": {},
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 17,
                "total": 17,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 227,
                "total": 227,
              },
              "raw": {
                "completion_tokens": 227,
                "prompt_tokens": 17,
                "total_tokens": 244,
              },
            },
          },
        ]
      `);
    });

    it('should send reasoning tokens', async () => {
      server.urls['https://api.openai.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Hello, World!"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"o4-mini","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":15,"completion_tokens":20,"total_tokens":35,"completion_tokens_details":{"reasoning_tokens":10}}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const model = provider.chat('o4-mini');

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
            "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
            "modelId": "o4-mini",
            "timestamp": 2023-12-15T16:17:00.000Z,
            "type": "response-metadata",
          },
          {
            "id": "0",
            "type": "text-start",
          },
          {
            "delta": "",
            "id": "0",
            "type": "text-delta",
          },
          {
            "delta": "Hello, World!",
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
              "openai": {},
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
                "text": 10,
                "total": 20,
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

  describe('raw chunks', () => {
    it('should include raw chunks when includeRawChunks is enabled', async () => {
      server.urls['https://api.openai.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":" World!"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"total_tokens":244,"completion_tokens":227}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: true,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw'))
        .toMatchInlineSnapshot(`
        [
          {
            "rawValue": {
              "choices": [
                {
                  "delta": {
                    "content": "",
                    "role": "assistant",
                  },
                  "finish_reason": null,
                  "index": 0,
                },
              ],
              "created": 1702657020,
              "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
              "model": "gpt-3.5-turbo-0613",
              "object": "chat.completion.chunk",
              "system_fingerprint": null,
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "choices": [
                {
                  "delta": {
                    "content": "Hello",
                  },
                  "finish_reason": null,
                  "index": 1,
                },
              ],
              "created": 1702657020,
              "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
              "model": "gpt-3.5-turbo-0613",
              "object": "chat.completion.chunk",
              "system_fingerprint": null,
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "choices": [
                {
                  "delta": {
                    "content": " World!",
                  },
                  "finish_reason": null,
                  "index": 1,
                },
              ],
              "created": 1702657020,
              "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
              "model": "gpt-3.5-turbo-0613",
              "object": "chat.completion.chunk",
              "system_fingerprint": null,
            },
            "type": "raw",
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
              "created": 1702657020,
              "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
              "model": "gpt-3.5-turbo-0613",
              "object": "chat.completion.chunk",
              "system_fingerprint": null,
            },
            "type": "raw",
          },
          {
            "rawValue": {
              "choices": [],
              "created": 1702657020,
              "id": "chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP",
              "model": "gpt-3.5-turbo-0613",
              "object": "chat.completion.chunk",
              "system_fingerprint": "fp_3bc1b5746c",
              "usage": {
                "completion_tokens": 227,
                "prompt_tokens": 17,
                "total_tokens": 244,
              },
            },
            "type": "raw",
          },
        ]
      `);
    });

    it('should not include raw chunks when includeRawChunks is false', async () => {
      server.urls['https://api.openai.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":" World!"},"finish_reason":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}]}\n\n`,
          `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"total_tokens":244,"completion_tokens":227}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
    });
  });
});
