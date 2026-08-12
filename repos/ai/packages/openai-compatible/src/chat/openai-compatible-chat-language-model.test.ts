import fs from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createOpenAICompatible } from '../openai-compatible-provider';
import { OpenAICompatibleChatLanguageModel } from './openai-compatible-chat-language-model';

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

const model = provider('grok-3');

const server = createTestServer({
  'https://my.api.com/v1/chat/completions': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  { headers }: { headers?: Record<string, string> } = {},
) {
  server.urls['https://my.api.com/v1/chat/completions'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/chat/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareChunksFixtureResponse(
  filename: string,
  { headers }: { headers?: Record<string, string> } = {},
) {
  const chunks = fs
    .readFileSync(`src/chat/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => `data: ${line}\n\n`);
  chunks.push('data: [DONE]\n\n');

  server.urls['https://my.api.com/v1/chat/completions'].response = {
    type: 'stream-chunks',
    headers,
    chunks,
  };
}

describe('config', () => {
  it('should extract base name from provider string', () => {
    const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
      provider: 'anthropic.beta',
      url: () => '',
      headers: () => ({}),
    });

    expect(model['providerOptionsName']).toBe('anthropic');
  });

  it('should handle provider without dot notation', () => {
    const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
      provider: 'openai',
      url: () => '',
      headers: () => ({}),
    });

    expect(model['providerOptionsName']).toBe('openai');
  });

  it('should return empty for empty provider', () => {
    const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
      provider: '',
      url: () => '',
      headers: () => ({}),
    });

    expect(model['providerOptionsName']).toBe('');
  });
});

describe('doGenerate', () => {
  function prepareJsonResponse({
    content = '',
    reasoning_content = '',
    reasoning = '',
    tool_calls,
    function_call,
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    finish_reason = 'stop',
    id = 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
    created = 1711115037,
    model = 'grok-3',
    headers,
  }: {
    content?: string;
    reasoning_content?: string;
    reasoning?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
      extra_content?: {
        google?: {
          thought_signature?: string;
        };
      };
    }>;
    function_call?: {
      name: string;
      arguments: string;
    };
    usage?: {
      prompt_tokens?: number;
      total_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: {
        cached_tokens?: number;
      };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
      };
    };
    finish_reason?: string;
    created?: number;
    id?: string;
    model?: string;
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'json-value',
      headers,
      body: {
        id,
        object: 'chat.completion',
        created,
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
              reasoning_content,
              reasoning,
              tool_calls,
              function_call,
            },
            finish_reason,
          },
        ],
        usage,
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };
  }

  describe('text (fixture)', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('xai-text');
    });

    it('should extract text content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('tool call (fixture)', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('xai-tool-call');
    });

    it('should extract tool call content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

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
          "reasoning": 320,
          "text": -318,
          "total": 2,
        },
        "raw": {
          "completion_tokens": 2,
          "completion_tokens_details": {
            "accepted_prediction_tokens": 0,
            "reasoning_tokens": 320,
            "rejected_prediction_tokens": 0,
          },
          "cost_in_usd_ticks": 1641500,
          "num_sources_used": 0,
          "prompt_tokens": 12,
          "prompt_tokens_details": {
            "cached_tokens": 2,
          },
          "total_tokens": 334,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    prepareJsonFixtureResponse('xai-text');

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.id).toMatchInlineSnapshot(
      `"edea4703-19aa-6d74-fedb-dc1c213543e0"`,
    );
    expect(response?.timestamp).toMatchInlineSnapshot(
      `2026-02-11T01:08:10.000Z`,
    );
    expect(response?.modelId).toMatchInlineSnapshot(`"grok-3-mini"`);
  });

  it('should expose the raw response headers', async () => {
    prepareJsonFixtureResponse('xai-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "2053",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should pass user setting to requests', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });
    const modelWithUser = provider('grok-3');
    await modelWithUser.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        xai: {
          user: 'test-user-id',
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
      }
    `);
  });

  it('should extract reasoning from reasoning field when reasoning_content is not provided', async () => {
    prepareJsonResponse({
      content: 'Hello, World!',
      reasoning: 'This is the reasoning from the reasoning field',
    });

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

  it('should prefer reasoning_content over reasoning field when both are provided', async () => {
    prepareJsonResponse({
      content: 'Hello, World!',
      reasoning_content: 'This is from reasoning_content',
      reasoning: 'This is from reasoning field',
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "text": "Hello, World!",
          "type": "text",
        },
        {
          "text": "This is from reasoning_content",
          "type": "reasoning",
        },
      ]
    `);
  });

  it('should support partial usage', async () => {
    prepareJsonResponse({
      usage: { prompt_tokens: 20, total_tokens: 20 },
    });

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

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      finish_reason: 'eos',
    });

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

  it('should pass the model and the messages', async () => {
    prepareJsonResponse({ content: '' });

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

  it('should pass settings', async () => {
    prepareJsonResponse();

    await provider('grok-3').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openaiCompatible: {
          user: 'test-user-id',
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
        "user": "test-user-id",
      }
    `);
  });

  it('should pass settings with deprecated openai-compatible key and emit warning', async () => {
    prepareJsonResponse();

    const result = await provider('grok-3').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        'openai-compatible': {
          user: 'test-user-id',
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
        "user": "test-user-id",
      }
    `);

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "message": "Use 'openaiCompatible' instead.",
          "setting": "providerOptions key 'openai-compatible'",
          "type": "deprecated",
        },
      ]
    `);
  });

  it('should include provider-specific options', async () => {
    prepareJsonResponse();

    await provider('grok-3').doGenerate({
      providerOptions: {
        'test-provider': {
          someCustomOption: 'test-value',
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
        "model": "grok-3",
        "someCustomOption": "test-value",
      }
    `);
  });

  it('should not include provider-specific options for different provider', async () => {
    prepareJsonResponse();

    await provider('grok-3').doGenerate({
      providerOptions: {
        notThisProviderName: {
          someCustomOption: 'test-value',
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
        "model": "grok-3",
      }
    `);
  });

  describe('camelCase provider options', () => {
    it('should accept camelCase provider options key for hyphenated provider name', async () => {
      prepareJsonResponse({ content: 'Hello!' });

      await provider('grok-3').doGenerate({
        providerOptions: {
          testProvider: {
            someCustomOption: 'test-value',
          },
        },
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'test-value',
      });
    });

    it('should prefer camelCase options over raw-name options', async () => {
      prepareJsonResponse({ content: 'Hello!' });

      await provider('grok-3').doGenerate({
        providerOptions: {
          'test-provider': {
            someCustomOption: 'raw-value',
          },
          testProvider: {
            someCustomOption: 'camel-value',
          },
        },
        prompt: TEST_PROMPT,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        someCustomOption: 'camel-value',
      });
    });

    it('should use camelCase metadata key when camelCase provider options are used', async () => {
      prepareJsonResponse({
        content: 'Hello!',
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
          completion_tokens_details: {
            accepted_prediction_tokens: 15,
          },
        },
      });

      const result = await provider('grok-3').doGenerate({
        providerOptions: {
          testProvider: { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
      });

      expect(result.providerMetadata).toHaveProperty('testProvider');
      expect(result.providerMetadata).not.toHaveProperty('test-provider');
      expect(result.providerMetadata!['testProvider']).toMatchObject({
        acceptedPredictionTokens: 15,
      });
    });

    it('should use raw metadata key when raw provider options are used', async () => {
      prepareJsonResponse({
        content: 'Hello!',
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
          completion_tokens_details: {
            accepted_prediction_tokens: 15,
          },
        },
      });

      const result = await provider('grok-3').doGenerate({
        providerOptions: {
          'test-provider': { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
      });

      expect(result.providerMetadata).toHaveProperty('test-provider');
      expect(result.providerMetadata!['test-provider']).toMatchObject({
        acceptedPredictionTokens: 15,
      });
    });

    it('should emit deprecated warning when raw provider options key is used', async () => {
      prepareJsonResponse({ content: 'Hello!' });

      const result = await provider('grok-3').doGenerate({
        providerOptions: {
          'test-provider': { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
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
      prepareJsonResponse({ content: 'Hello!' });

      const result = await provider('grok-3').doGenerate({
        providerOptions: {
          testProvider: { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
      });

      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should use raw metadata key when no provider options are passed', async () => {
      prepareJsonResponse({ content: 'Hello!' });

      const result = await provider('grok-3').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.providerMetadata).toHaveProperty('test-provider');
    });

    it('should include thought signature in providerMetadata with camelCase key', async () => {
      prepareJsonResponse({
        tool_calls: [
          {
            id: 'call-1',
            type: 'function' as const,
            function: {
              name: 'test_tool',
              arguments: '{"arg":"value"}',
            },
            extra_content: {
              google: { thought_signature: '<Sig>' },
            },
          },
        ],
      });

      const result = await provider('grok-3').doGenerate({
        providerOptions: { testProvider: {} },
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchObject([
        {
          type: 'tool-call',
          providerMetadata: {
            testProvider: { thoughtSignature: '<Sig>' },
          },
        },
      ]);
    });

    it('should include thought signature in providerMetadata with raw key', async () => {
      prepareJsonResponse({
        tool_calls: [
          {
            id: 'call-1',
            type: 'function' as const,
            function: {
              name: 'test_tool',
              arguments: '{"arg":"value"}',
            },
            extra_content: {
              google: { thought_signature: '<Sig>' },
            },
          },
        ],
      });

      const result = await provider('grok-3').doGenerate({
        providerOptions: { 'test-provider': {} },
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchObject([
        {
          type: 'tool-call',
          providerMetadata: {
            'test-provider': { thoughtSignature: '<Sig>' },
          },
        },
      ]);
    });
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonResponse({ content: '' });

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
    prepareJsonResponse({ content: '' });

    const provider = createOpenAICompatible({
      baseURL: 'https://my.api.com/v1/',
      name: 'test-provider',
      headers: {
        Authorization: `Bearer test-api-key`,
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider('grok-3').doGenerate({
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

  describe('Google Gemini thought signatures (OpenAI compatibility)', () => {
    it('should parse thought signature from extra_content and include in providerMetadata', async () => {
      prepareJsonResponse({
        tool_calls: [
          {
            id: 'function-call-1',
            type: 'function',
            function: {
              name: 'check_flight',
              arguments: '{"flight":"AA100"}',
            },
            extra_content: {
              google: {
                thought_signature: '<Signature A>',
              },
            },
          },
        ],
      });

      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'check_flight',
            inputSchema: {
              type: 'object',
              properties: { flight: { type: 'string' } },
              required: ['flight'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"flight":"AA100"}",
            "providerMetadata": {
              "test-provider": {
                "thoughtSignature": "<Signature A>",
              },
            },
            "toolCallId": "function-call-1",
            "toolName": "check_flight",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('should handle parallel tool calls with signature only on first call', async () => {
      prepareJsonResponse({
        tool_calls: [
          {
            id: 'function-call-paris',
            type: 'function',
            function: {
              name: 'get_current_temperature',
              arguments: '{"location":"Paris"}',
            },
            extra_content: {
              google: {
                thought_signature: '<Signature A>',
              },
            },
          },
          {
            id: 'function-call-london',
            type: 'function',
            function: {
              name: 'get_current_temperature',
              arguments: '{"location":"London"}',
            },
            // No extra_content - parallel calls don't have signatures
          },
        ],
      });

      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'get_current_temperature',
            inputSchema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"location":"Paris"}",
            "providerMetadata": {
              "test-provider": {
                "thoughtSignature": "<Signature A>",
              },
            },
            "toolCallId": "function-call-paris",
            "toolName": "get_current_temperature",
            "type": "tool-call",
          },
          {
            "input": "{"location":"London"}",
            "toolCallId": "function-call-london",
            "toolName": "get_current_temperature",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('should not include providerMetadata when no thought signature is present', async () => {
      prepareJsonResponse({
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'some_tool',
              arguments: '{"param":"value"}',
            },
            // No extra_content
          },
        ],
      });

      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'some_tool',
            inputSchema: {
              type: 'object',
              properties: { param: { type: 'string' } },
              required: ['param'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"param":"value"}",
            "toolCallId": "call-1",
            "toolName": "some_tool",
            "type": "tool-call",
          },
        ]
      `);
    });
  });

  describe('response format', () => {
    it('should not send a response_format when response format is text', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: false,
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'text' },
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
        }
      `);
    });

    it('should forward json response format as "json_object" without schema', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = provider('gpt-4o-2024-08-06');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'json' },
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
            "type": "json_object",
          },
        }
      `);
    });

    it('should forward json response format as "json_object" and omit schema when structuredOutputs are disabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: false,
      });

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
            "type": "json_object",
          },
        }
      `);

      expect(warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "JSON response format schema is only supported with structuredOutputs",
            "feature": "responseFormat",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should forward json response format as "json_object" and include schema when structuredOutputs are enabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: true,
      });

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

    it('should pass reasoningEffort setting from providerOptions', async () => {
      prepareJsonResponse({ content: '{"value":"test"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          'test-provider': { reasoningEffort: 'high' },
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
          "model": "gpt-5",
          "reasoning_effort": "high",
        }
      `);
    });

    it('should not duplicate reasoningEffort in request body', async () => {
      prepareJsonResponse({ content: '{"value":"test"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          'test-provider': {
            reasoningEffort: 'high',
            customOption: 'should-be-included',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;

      expect(body.reasoning_effort).toBe('high');
      expect(body.reasoningEffort).toBeUndefined();
      expect(body.customOption).toBe('should-be-included');
    });

    it('should pass top-level reasoning as reasoning_effort', async () => {
      prepareJsonResponse({ content: 'test' });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'medium',
      );
    });

    it('should not pass top-level reasoning none as reasoning_effort', async () => {
      prepareJsonResponse({ content: 'test' });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      expect(
        (await server.calls[0].requestBodyJson).reasoning_effort,
      ).toBeUndefined();
    });

    it('should prefer providerOptions reasoningEffort over top-level reasoning', async () => {
      prepareJsonResponse({ content: 'test' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
        providerOptions: {
          'test-provider': { reasoningEffort: 'high' },
        },
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should pass textVerbosity setting from providerOptions', async () => {
      prepareJsonResponse({ content: '{"value":"test"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          'test-provider': { textVerbosity: 'low' },
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
          "model": "gpt-5",
          "verbosity": "low",
        }
      `);
    });

    it('should not duplicate textVerbosity in request body', async () => {
      prepareJsonResponse({ content: '{"value":"test"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          'test-provider': {
            textVerbosity: 'medium',
            customOption: 'should-be-included',
          },
        },
      });

      const body = await server.calls[0].requestBodyJson;

      expect(body.verbosity).toBe('medium');
      expect(body.textVerbosity).toBeUndefined();
      expect(body.customOption).toBe('should-be-included');
    });

    it('should use json_schema & strict with responseFormat json when structuredOutputs are enabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: true,
      });

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

    it('should set name & description with responseFormat json when structuredOutputs are enabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: true,
      });

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

    it('should send strict: false when strictJsonSchema is explicitly disabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: true,
      });

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
        providerOptions: {
          'test-provider': {
            strictJsonSchema: false,
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
              "strict": false,
            },
            "type": "json_schema",
          },
        }
      `);
    });

    it('should allow for undefined schema with responseFormat json when structuredOutputs are enabled', async () => {
      prepareJsonResponse({ content: '{"value":"Spark"}' });

      const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
        provider: 'test-provider',
        url: () => 'https://my.api.com/v1/chat/completions',
        headers: () => ({}),
        supportsStructuredOutputs: true,
      });

      await model.doGenerate({
        responseFormat: {
          type: 'json',
          name: 'test-name',
          description: 'test description',
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
            "type": "json_object",
          },
        }
      `);
    });
  });

  it('should send request body', async () => {
    prepareJsonResponse({ content: '' });

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": "{"model":"grok-3","messages":[{"role":"user","content":"Hello"}]}",
      }
    `);
  });

  describe('usage details', () => {
    it('should extract detailed token usage when available', async () => {
      prepareJsonResponse({
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
          prompt_tokens_details: {
            cached_tokens: 5,
          },
          completion_tokens_details: {
            reasoning_tokens: 10,
            accepted_prediction_tokens: 15,
            rejected_prediction_tokens: 5,
          },
        },
      });

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 5,
            "cacheWrite": undefined,
            "noCache": 15,
            "total": 20,
          },
          "outputTokens": {
            "reasoning": 10,
            "text": 20,
            "total": 30,
          },
          "raw": {
            "completion_tokens": 30,
            "completion_tokens_details": {
              "accepted_prediction_tokens": 15,
              "reasoning_tokens": 10,
              "rejected_prediction_tokens": 5,
            },
            "prompt_tokens": 20,
            "prompt_tokens_details": {
              "cached_tokens": 5,
            },
            "total_tokens": 50,
          },
        }
      `);
      expect(result.providerMetadata).toMatchInlineSnapshot(`
        {
          "test-provider": {
            "acceptedPredictionTokens": 15,
            "rejectedPredictionTokens": 5,
          },
        }
      `);
    });

    it('should handle missing token details', async () => {
      prepareJsonResponse({
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          // No token details provided
        },
      });

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.providerMetadata!['test-provider']).toMatchInlineSnapshot(
        `{}`,
      );
    });

    it('should handle partial token details', async () => {
      prepareJsonResponse({
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
          prompt_tokens_details: {
            cached_tokens: 5,
          },
          completion_tokens_details: {
            // Only reasoning tokens provided
            reasoning_tokens: 10,
          },
        },
      });

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 5,
            "cacheWrite": undefined,
            "noCache": 15,
            "total": 20,
          },
          "outputTokens": {
            "reasoning": 10,
            "text": 20,
            "total": 30,
          },
          "raw": {
            "completion_tokens": 30,
            "completion_tokens_details": {
              "reasoning_tokens": 10,
            },
            "prompt_tokens": 20,
            "prompt_tokens_details": {
              "cached_tokens": 5,
            },
            "total_tokens": 50,
          },
        }
      `);
    });

    it('should preserve extra usage fields from provider-specific responses', async () => {
      server.urls['https://my.api.com/v1/chat/completions'].response = {
        type: 'json-value',
        body: {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1711115037,
          model: 'grok-3',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello!',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 18,
            completion_tokens: 439,
            total_tokens: 457,
            // Provider-specific extra fields (e.g., from Groq)
            queue_time: 0.061348671,
            prompt_time: 0.000211569,
            completion_time: 0.798181818,
            total_time: 0.798393387,
          },
        },
      };

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.usage.raw).toMatchInlineSnapshot(`
        {
          "completion_time": 0.798181818,
          "completion_tokens": 439,
          "prompt_time": 0.000211569,
          "prompt_tokens": 18,
          "queue_time": 0.061348671,
          "total_time": 0.798393387,
          "total_tokens": 457,
        }
      `);
    });
  });
});

describe('doStream', () => {
  function prepareStreamResponse({
    content = [],
    finish_reason = 'stop',
    headers,
  }: {
    content?: string[];
    finish_reason?: string;
    headers?: Record<string, string>;
  }) {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      headers,
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        ...content.map(text => {
          return (
            `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
            `"system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"${text}"},"finish_reason":null}]}\n\n`
          );
        }),
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"${finish_reason}"}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"${finish_reason}"}],` +
          `"usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  describe('text (fixture)', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('xai-text');
    });

    it('should stream text content', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('tool call (fixture)', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('xai-tool-call');
    });

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
      headers: { 'test-header': 'test-value' },
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

  it('should handle empty string role in delta chunks', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"role":"","content":"Hello"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"role":"","content":" World"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const textDeltas = events.filter(e => e.type === 'text-delta');

    expect(textDeltas).toStrictEqual([
      { type: 'text-delta', delta: 'Hello', id: 'txt-0' },
      { type: 'text-delta', delta: ' World', id: 'txt-0' },
    ]);
  });

  it('should respect the includeUsage option', async () => {
    prepareStreamResponse({
      content: ['Hello', ', ', 'World!'],
      finish_reason: 'stop',
    });

    const model = new OpenAICompatibleChatLanguageModel('gpt-4o-2024-08-06', {
      provider: 'test-provider',
      url: () => 'https://my.api.com/v1/chat/completions',
      headers: () => ({}),
      includeUsage: true,
    });

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const body = await server.calls[0].requestBodyJson;

    expect(body.stream).toBe(true);
    expect(body.stream_options).toMatchInlineSnapshot(`
      {
        "include_usage": true,
      }
    `);
  });

  it('should stream reasoning content before text deltas', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"", "reasoning_content":"Let me think"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"", "reasoning_content":" about this"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Here's"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":" my response"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],` +
          `"usage":{"prompt_tokens":18,"completion_tokens":439}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-start",
        },
        {
          "delta": "Let me think",
          "id": "reasoning-0",
          "type": "reasoning-delta",
        },
        {
          "delta": " about this",
          "id": "reasoning-0",
          "type": "reasoning-delta",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-end",
        },
        {
          "id": "txt-0",
          "type": "text-start",
        },
        {
          "delta": "Here's",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "delta": " my response",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "id": "txt-0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_tokens": 439,
              "prompt_tokens": 18,
            },
          },
        },
      ]
    `);
  });

  it('should stream reasoning from reasoning field when reasoning_content is not provided', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"", "reasoning":"Let me consider"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"", "reasoning":" this carefully"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"My answer is"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":" correct"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],` +
          `"usage":{"prompt_tokens":18,"completion_tokens":439}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-start",
        },
        {
          "delta": "Let me consider",
          "id": "reasoning-0",
          "type": "reasoning-delta",
        },
        {
          "delta": " this carefully",
          "id": "reasoning-0",
          "type": "reasoning-delta",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-end",
        },
        {
          "id": "txt-0",
          "type": "text-start",
        },
        {
          "delta": "My answer is",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "delta": " correct",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "id": "txt-0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_tokens": 439,
              "prompt_tokens": 18,
            },
          },
        },
      ]
    `);
  });

  it('should prefer reasoning_content over reasoning field in streaming when both are provided', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"", "reasoning_content":"From reasoning_content", "reasoning":"From reasoning"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Final response"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],` +
          `"usage":{"prompt_tokens":18,"completion_tokens":439}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-start",
        },
        {
          "delta": "From reasoning_content",
          "id": "reasoning-0",
          "type": "reasoning-delta",
        },
        {
          "id": "reasoning-0",
          "type": "reasoning-end",
        },
        {
          "id": "txt-0",
          "type": "text-start",
        },
        {
          "delta": "Final response",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "id": "txt-0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_tokens": 439,
              "prompt_tokens": 18,
            },
          },
        },
      ]
    `);
  });

  it('should stream tool deltas', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"value"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
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
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_time": 0.798181818,
              "completion_tokens": 439,
              "prompt_time": 0.000211569,
              "prompt_tokens": 18,
              "queue_time": 0.061348671,
              "total_time": 0.798393387,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should stream tool deltas when function.name arrives in a later chunk', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":null},"finish_reason":null}]}\n\n`,
        // First tool_calls delta carries id and (empty) arguments but no function.name
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_late","type":"function","function":{"arguments":""}}]},` +
          `"finish_reason":null}]}\n\n`,
        // function.name arrives in the next chunk together with the start of the arguments
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_late","type":"function","function":{"name":"test-tool","arguments":"{\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"value"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"hi\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-late-name","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"prompt_tokens":18,"completion_tokens":10,"total_tokens":28}}\n\n`,
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
          "id": "chatcmpl-late-name",
          "modelId": "grok-3",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "call_late",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"",
          "id": "call_late",
          "type": "tool-input-delta",
        },
        {
          "delta": "value",
          "id": "call_late",
          "type": "tool-input-delta",
        },
        {
          "delta": "":"hi"}",
          "id": "call_late",
          "type": "tool-input-delta",
        },
        {
          "id": "call_late",
          "type": "tool-input-end",
        },
        {
          "input": "{"value":"hi"}",
          "toolCallId": "call_late",
          "toolName": "test-tool",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "tool-calls",
          },
          "providerMetadata": {
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 10,
              "total": 10,
            },
            "raw": {
              "completion_tokens": 10,
              "prompt_tokens": 18,
              "total_tokens": 28,
            },
          },
        },
      ]
    `);
  });

  it('should error when streamed tool call never receives a function.name', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-no-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":null},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-no-name","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_missing","type":"function","function":{"arguments":"{}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-no-name","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"prompt_tokens":18,"completion_tokens":10,"total_tokens":28}}\n\n`,
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
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    await expect(
      convertReadableStreamToArray(stream),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_InvalidResponseDataError: Expected 'function.name' to be a string.]`,
    );
  });

  it('should stream tool call with thought signature from extra_content', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk with tool call start and thought signature in extra_content
        `data: {"id":"chatcmpl-gemini-thought","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"function-call-1","type":"function","function":{"name":"check_flight","arguments":""},` +
          `"extra_content":{"google":{"thought_signature":"<Signature A>"}}}]},` +
          `"finish_reason":null}]}\n\n`,
        // Subsequent chunks with arguments
        `data: {"id":"chatcmpl-gemini-thought","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"flight\\":"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-gemini-thought","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"AA100\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-gemini-thought","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'check_flight',
          inputSchema: {
            type: 'object',
            properties: { flight: { type: 'string' } },
            required: ['flight'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Find the tool-call event and verify it has the thought signature in providerMetadata
    const toolCallEvent = result.find(
      (event: { type: string }) => event.type === 'tool-call',
    );
    expect(toolCallEvent).toMatchObject({
      type: 'tool-call',
      toolCallId: 'function-call-1',
      toolName: 'check_flight',
      input: '{"flight":"AA100"}',
      providerMetadata: {
        'test-provider': {
          thoughtSignature: '<Signature A>',
        },
      },
    });
  });

  it('should stream parallel tool calls with signature only on first call', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk with two tool calls - only first has thought signature
        `data: {"id":"chatcmpl-gemini-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[` +
          `{"index":0,"id":"call-paris","type":"function","function":{"name":"get_weather","arguments":""},` +
          `"extra_content":{"google":{"thought_signature":"<Signature A>"}}},` +
          `{"index":1,"id":"call-london","type":"function","function":{"name":"get_weather","arguments":""}}` +
          `]},` +
          `"finish_reason":null}]}\n\n`,
        // Arguments for first call
        `data: {"id":"chatcmpl-gemini-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":\\"Paris\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        // Arguments for second call
        `data: {"id":"chatcmpl-gemini-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{\\"location\\":\\"London\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-gemini-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gemini-3-pro",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    const toolCallEvents = result.filter(
      (event: { type: string }) => event.type === 'tool-call',
    );

    expect(toolCallEvents).toHaveLength(2);

    // First tool call should have thought signature
    expect(toolCallEvents[0]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-paris',
      toolName: 'get_weather',
      providerMetadata: {
        'test-provider': {
          thoughtSignature: '<Signature A>',
        },
      },
    });

    // Second tool call should NOT have thought signature
    expect(toolCallEvents[1]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-london',
      toolName: 'get_weather',
    });
    expect(
      (toolCallEvents[1] as { providerMetadata?: unknown }).providerMetadata,
    ).toBeUndefined();
  });

  it('should stream tool call deltas when tool call arguments are passed in the first chunk', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"va"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"lue"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
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
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_time": 0.798181818,
              "completion_tokens": 439,
              "prompt_time": 0.000211569,
              "prompt_tokens": 18,
              "queue_time": 0.061348671,
              "total_time": 0.798393387,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should not duplicate tool calls when there is an additional empty chunk after the tool call has been completed', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
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
            "test-provider": {},
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

  it('should stream tool call that is sent in one chunk', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\"value\\":\\"Sparkle Day\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}\n\n`,
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
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
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_time": 0.798181818,
              "completion_tokens": 439,
              "prompt_time": 0.000211569,
              "prompt_tokens": 18,
              "queue_time": 0.061348671,
              "total_time": 0.798393387,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should stream empty tool call that is sent in one chunk', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"grok-3",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"grok-3",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],` +
          `"usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}\n\n`,
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
            properties: {},
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
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "grok-3",
          "timestamp": 2024-03-25T09:06:38.000Z,
          "type": "response-metadata",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
          "type": "tool-input-end",
        },
        {
          "input": "",
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
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_time": 0.798181818,
              "completion_tokens": 439,
              "prompt_time": 0.000211569,
              "prompt_tokens": 18,
              "queue_time": 0.061348671,
              "total_time": 0.798393387,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should handle error stream parts', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error": {"message": "Incorrect API key provided: as***T7. You can obtain an API key from https://console.api.com.", "code": "Client specified an invalid argument"}}\n\n`,
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
          "error": "Incorrect API key provided: as***T7. You can obtain an API key from https://console.api.com.",
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "providerMetadata": {
            "test-provider": {},
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
    server.urls['https://my.api.com/v1/chat/completions'].response = {
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
              "test-provider": {},
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

  it('should pass the messages and the model', async () => {
    prepareStreamResponse({ content: [] });

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
      }
    `);
  });

  it('should pass headers', async () => {
    prepareStreamResponse({ content: [] });

    const provider = createOpenAICompatible({
      baseURL: 'https://my.api.com/v1',
      name: 'test-provider',
      headers: {
        Authorization: `Bearer test-api-key`,
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider('grok-3').doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(await server.calls[0].requestHeaders).toMatchInlineSnapshot(`
      {
        "authorization": "Bearer test-api-key",
        "content-type": "application/json",
        "custom-provider-header": "provider-header-value",
        "custom-request-header": "request-header-value",
      }
    `);
  });

  it('should include provider-specific options', async () => {
    prepareStreamResponse({ content: [] });

    await provider('grok-3').doStream({
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
        "messages": [
          {
            "content": "Hello",
            "role": "user",
          },
        ],
        "model": "grok-3",
        "someCustomOption": "test-value",
        "stream": true,
      }
    `);
  });

  it('should not include provider-specific options for different provider', async () => {
    prepareStreamResponse({ content: [] });

    await provider('grok-3').doStream({
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
        "messages": [
          {
            "content": "Hello",
            "role": "user",
          },
        ],
        "model": "grok-3",
        "stream": true,
      }
    `);
  });

  describe('camelCase provider options', () => {
    it('should accept camelCase provider options key for hyphenated provider name', async () => {
      prepareStreamResponse({ content: [] });

      await provider('grok-3').doStream({
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
      prepareStreamResponse({ content: [] });

      await provider('grok-3').doStream({
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

    it('should emit deprecated warning when raw provider options key is used', async () => {
      prepareStreamResponse({ content: ['Hello'] });

      const { stream } = await provider('grok-3').doStream({
        providerOptions: {
          'test-provider': { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const streamStart = parts.find(part => part.type === 'stream-start');

      expect(streamStart?.warnings).toMatchInlineSnapshot(`
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
      prepareStreamResponse({ content: ['Hello'] });

      const { stream } = await provider('grok-3').doStream({
        providerOptions: {
          testProvider: { reasoningEffort: 'high' },
        },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const streamStart = parts.find(part => part.type === 'stream-start');

      expect(streamStart?.warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should use camelCase metadata key in finish event when camelCase options are used', async () => {
      prepareStreamResponse({ content: ['Hello'] });

      const { stream } = await provider('grok-3').doStream({
        providerOptions: { testProvider: {} },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(finishPart?.providerMetadata).toHaveProperty('testProvider');
      expect(finishPart?.providerMetadata).not.toHaveProperty('test-provider');
    });

    it('should use raw metadata key in finish event when raw options are used', async () => {
      prepareStreamResponse({ content: ['Hello'] });

      const { stream } = await provider('grok-3').doStream({
        providerOptions: { 'test-provider': {} },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(finishPart?.providerMetadata).toHaveProperty('test-provider');
    });

    it('should use raw metadata key in finish event when no provider options are passed', async () => {
      prepareStreamResponse({ content: ['Hello'] });

      const { stream } = await provider('grok-3').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(finishPart?.providerMetadata).toHaveProperty('test-provider');
    });

    it('should use camelCase metadata key for thought signatures in streamed tool calls', async () => {
      server.urls['https://my.api.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chat-id","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"test_tool","arguments":"{\\"a\\":1}"},"extra_content":{"google":{"thought_signature":"<Sig>"}}}]},"finish_reason":null}]}\n\n`,
          `data: {"id":"chat-id","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await provider('grok-3').doStream({
        providerOptions: { testProvider: {} },
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const toolCallEvent = parts.find(part => part.type === 'tool-call');

      expect(toolCallEvent).toMatchObject({
        type: 'tool-call',
        providerMetadata: {
          testProvider: { thoughtSignature: '<Sig>' },
        },
      });
    });
  });

  it('should send request body', async () => {
    prepareStreamResponse({ content: [] });

    const { request } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": {
          "frequency_penalty": undefined,
          "max_tokens": undefined,
          "messages": [
            {
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "grok-3",
          "presence_penalty": undefined,
          "reasoning_effort": undefined,
          "response_format": undefined,
          "seed": undefined,
          "stop": undefined,
          "stream": true,
          "stream_options": undefined,
          "temperature": undefined,
          "tool_choice": undefined,
          "tools": undefined,
          "top_p": undefined,
          "user": undefined,
          "verbosity": undefined,
        },
      }
    `);
  });

  describe('usage details in streaming', () => {
    it('should extract detailed token usage from stream finish', async () => {
      server.urls['https://my.api.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chat-id","choices":[{"delta":{"content":"Hello"}}]}\n\n`,
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],` +
            `"usage":{"prompt_tokens":20,"completion_tokens":30,` +
            `"prompt_tokens_details":{"cached_tokens":5},` +
            `"completion_tokens_details":{` +
            `"reasoning_tokens":10,` +
            `"accepted_prediction_tokens":15,` +
            `"rejected_prediction_tokens":5}}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(finishPart).toMatchInlineSnapshot(`
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {
              "acceptedPredictionTokens": 15,
              "rejectedPredictionTokens": 5,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 5,
              "cacheWrite": undefined,
              "noCache": 15,
              "total": 20,
            },
            "outputTokens": {
              "reasoning": 10,
              "text": 20,
              "total": 30,
            },
            "raw": {
              "completion_tokens": 30,
              "completion_tokens_details": {
                "accepted_prediction_tokens": 15,
                "reasoning_tokens": 10,
                "rejected_prediction_tokens": 5,
              },
              "prompt_tokens": 20,
              "prompt_tokens_details": {
                "cached_tokens": 5,
              },
            },
          },
        }
      `);
    });

    it('should handle missing token details in stream', async () => {
      server.urls['https://my.api.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chat-id","choices":[{"delta":{"content":"Hello"}}]}\n\n`,
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],` +
            `"usage":{"prompt_tokens":20,"completion_tokens":30}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(
        finishPart?.providerMetadata!['test-provider'],
      ).toMatchInlineSnapshot(`{}`);
    });

    it('should handle partial token details in stream', async () => {
      server.urls['https://my.api.com/v1/chat/completions'].response = {
        type: 'stream-chunks',
        chunks: [
          `data: {"id":"chat-id","choices":[{"delta":{"content":"Hello"}}]}\n\n`,
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],` +
            `"usage":{"prompt_tokens":20,"completion_tokens":30,` +
            `"total_tokens":50,` +
            `"prompt_tokens_details":{"cached_tokens":5},` +
            `"completion_tokens_details":{"reasoning_tokens":10}}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finishPart = parts.find(part => part.type === 'finish');

      expect(finishPart).toMatchInlineSnapshot(`
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {},
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 5,
              "cacheWrite": undefined,
              "noCache": 15,
              "total": 20,
            },
            "outputTokens": {
              "reasoning": 10,
              "text": 20,
              "total": 30,
            },
            "raw": {
              "completion_tokens": 30,
              "completion_tokens_details": {
                "reasoning_tokens": 10,
              },
              "prompt_tokens": 20,
              "prompt_tokens_details": {
                "cached_tokens": 5,
              },
              "total_tokens": 50,
            },
          },
        }
      `);
    });
  });
});

describe('metadata extraction', () => {
  const testMetadataExtractor = {
    extractMetadata: async ({ parsedBody }: { parsedBody: unknown }) => {
      if (
        typeof parsedBody !== 'object' ||
        !parsedBody ||
        !('test_field' in parsedBody)
      ) {
        return undefined;
      }
      return {
        'test-provider': {
          value: parsedBody.test_field as string,
        },
      };
    },
    createStreamExtractor: () => {
      let accumulatedValue: string | undefined;

      return {
        processChunk: (chunk: unknown) => {
          if (
            typeof chunk === 'object' &&
            chunk &&
            'choices' in chunk &&
            Array.isArray(chunk.choices) &&
            chunk.choices[0]?.finish_reason === 'stop' &&
            'test_field' in chunk
          ) {
            accumulatedValue = chunk.test_field as string;
          }
        },
        buildMetadata: () =>
          accumulatedValue
            ? {
                'test-provider': {
                  value: accumulatedValue,
                },
              }
            : undefined,
      };
    },
  };

  it('should process metadata from complete response', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-5',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
            },
            finish_reason: 'stop',
          },
        ],
        test_field: 'test_value',
      },
    };

    const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
      provider: 'test-provider',
      url: () => 'https://my.api.com/v1/chat/completions',
      headers: () => ({}),
      metadataExtractor: testMetadataExtractor,
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.providerMetadata).toEqual({
      'test-provider': {
        value: 'test_value',
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
        "model": "gpt-5",
      }
    `);
  });

  it('should process metadata from streaming response', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"test_field":"test_value"}\n\n',
        'data: [DONE]\n\n',
      ],
    };

    const model = new OpenAICompatibleChatLanguageModel('gpt-5', {
      provider: 'test-provider',
      url: () => 'https://my.api.com/v1/chat/completions',
      headers: () => ({}),
      metadataExtractor: testMetadataExtractor,
    });

    const result = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const parts = await convertReadableStreamToArray(result.stream);
    const finishPart = parts.find(part => part.type === 'finish');

    expect(finishPart?.providerMetadata).toEqual({
      'test-provider': {
        value: 'test_value',
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
        "model": "gpt-5",
        "stream": true,
      }
    `);
  });
});

describe('raw chunks', () => {
  it('should include raw chunks when includeRawChunks is true', async () => {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chat-id","choices":[{"delta":{"content":"Hello"}}]}\n\n`,
        `data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n`,
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
                },
              },
            ],
            "id": "chat-id",
          },
          "type": "raw",
        },
        {
          "id": "chat-id",
          "modelId": undefined,
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "txt-0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "txt-0",
          "type": "text-delta",
        },
        {
          "rawValue": {
            "choices": [
              {
                "delta": {},
                "finish_reason": "stop",
              },
            ],
          },
          "type": "raw",
        },
        {
          "id": "txt-0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "stop",
            "unified": "stop",
          },
          "providerMetadata": {
            "test-provider": {},
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
});

describe('transformRequestBody', () => {
  function prepareTransformJsonResponse() {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1711115037,
        model: 'grok-3',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
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
  }

  function prepareTransformStreamResponse() {
    server.urls['https://my.api.com/v1/chat/completions'].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1711115037,"model":"grok-3","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1711115037,"model":"grok-3","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should transform request body in doGenerate when transformRequestBody is provided', async () => {
    const transformFn = vi.fn((body: Record<string, any>) => ({
      ...body,
      custom_field: 'added-by-transform',
    }));

    prepareTransformJsonResponse();

    const model = new OpenAICompatibleChatLanguageModel('grok-3', {
      provider: 'test-provider',
      url: ({ path }) => `https://my.api.com/v1${path}`,
      headers: () => ({}),
      transformRequestBody: transformFn,
    });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    // Verify transform was called
    expect(transformFn).toHaveBeenCalledOnce();
    expect(transformFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-3',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    );

    // Verify transformed body was sent
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      custom_field: 'added-by-transform',
    });
  });

  it('should transform request body in doStream when transformRequestBody is provided', async () => {
    const transformFn = vi.fn((body: Record<string, any>) => ({
      ...body,
      custom_field: 'added-by-transform',
    }));

    prepareTransformStreamResponse();

    const model = new OpenAICompatibleChatLanguageModel('grok-3', {
      provider: 'test-provider',
      url: ({ path }) => `https://my.api.com/v1${path}`,
      headers: () => ({}),
      transformRequestBody: transformFn,
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    // Consume the stream
    await convertReadableStreamToArray(stream);

    // Verify transform was called
    expect(transformFn).toHaveBeenCalledOnce();
    expect(transformFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-3',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
    );

    // Verify transformed body was sent
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      custom_field: 'added-by-transform',
    });
  });

  it('should work without transformRequestBody', async () => {
    prepareTransformJsonResponse();

    const model = new OpenAICompatibleChatLanguageModel('grok-3', {
      provider: 'test-provider',
      url: ({ path }) => `https://my.api.com/v1${path}`,
      headers: () => ({}),
    });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).toMatchObject({
      model: 'grok-3',
    });
    expect(requestBody).not.toHaveProperty('custom_field');
  });
});
