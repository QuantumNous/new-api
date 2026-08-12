import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import fs from 'node:fs';
import { createGroq } from './groq-provider';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

const provider = createGroq({ apiKey: 'test-api-key' });
const model = provider('gemma2-9b-it');

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
      prepareJsonFixtureResponse('groq-text');
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
              "content": "Hello",
              "role": "user",
            },
          ],
          "model": "gemma2-9b-it",
        }
      `);
    });
  });

  describe('tool call', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('groq-tool-call');
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
      prepareJsonFixtureResponse('groq-reasoning');
    });

    it('should extract reasoning content', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('top-level reasoning', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('groq-text');
    });

    it('should map top-level reasoning to reasoning_effort', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should coerce top-level reasoning minimal to low', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'minimal',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'low',
      );
    });

    it('should coerce top-level reasoning xhigh to high', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'xhigh',
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });

    it('should not pass top-level reasoning none as reasoning_effort', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      expect(
        (await server.calls[0].requestBodyJson).reasoning_effort,
      ).toBeUndefined();
    });

    it('should prefer providerOptions reasoningEffort over top-level reasoning', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
        providerOptions: {
          groq: { reasoningEffort: 'high' },
        },
      });

      expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
        'high',
      );
    });
  });

  it('should extract usage', async () => {
    prepareJsonFixtureResponse('groq-text');

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 45,
          "total": 45,
        },
        "outputTokens": {
          "reasoning": undefined,
          "text": 607,
          "total": 607,
        },
        "raw": {
          "completion_tokens": 607,
          "prompt_tokens": 45,
          "total_tokens": 652,
        },
      }
    `);
  });

  it('should send additional response information', async () => {
    prepareJsonFixtureResponse('groq-text');

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect({
      id: response?.id,
      timestamp: response?.timestamp,
      modelId: response?.modelId,
    }).toMatchInlineSnapshot(`
      {
        "id": "chatcmpl-09d64d2a-ed1c-4473-829f-78db43f45d13",
        "modelId": "llama-3.3-70b-versatile",
        "timestamp": 2026-02-11T00:46:38.000Z,
      }
    `);
  });

  it('should support partial usage', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gemma2-9b-it',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, total_tokens: 20 },
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

  it('should extract cached input tokens', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gemma2-9b-it',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 25,
          completion_tokens: 5,
          prompt_tokens_details: {
            cached_tokens: 15,
          },
        },
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
          "prompt_tokens_details": {
            "cached_tokens": 15,
          },
          "total_tokens": 25,
        },
      }
    `);
  });

  it('should extract reasoning tokens from completion_tokens_details', async () => {
    prepareJsonFixtureResponse('groq-reasoning');

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": undefined,
          "cacheWrite": undefined,
          "noCache": 17,
          "total": 17,
        },
        "outputTokens": {
          "reasoning": 570,
          "text": 79,
          "total": 649,
        },
        "raw": {
          "completion_tokens": 649,
          "completion_tokens_details": {
            "reasoning_tokens": 570,
          },
          "prompt_tokens": 17,
          "total_tokens": 666,
        },
      }
    `);
  });

  it('should support unknown finish reason', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gemma2-9b-it',
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
    prepareJsonFixtureResponse('groq-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "3547",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should pass provider options', async () => {
    prepareJsonFixtureResponse('groq-text');

    await provider('gemma2-9b-it').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        groq: {
          reasoningFormat: 'hidden',
          user: 'test-user-id',
          parallelToolCalls: false,
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
        "model": "gemma2-9b-it",
        "parallel_tool_calls": false,
        "reasoning_format": "hidden",
        "user": "test-user-id",
      }
    `);
  });

  it('should pass serviceTier provider option', async () => {
    prepareJsonFixtureResponse('groq-text');

    await provider('gemma2-9b-it').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        groq: {
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
        "model": "gemma2-9b-it",
        "service_tier": "flex",
      }
    `);
  });

  it('should pass performance serviceTier provider option', async () => {
    prepareJsonFixtureResponse('groq-text');

    await provider('gemma2-9b-it').doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        groq: {
          serviceTier: 'performance',
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
        "model": "gemma2-9b-it",
        "service_tier": "performance",
      }
    `);
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonFixtureResponse('groq-text');

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
        "model": "gemma2-9b-it",
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
    prepareJsonFixtureResponse('groq-text');

    const provider = createGroq({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider('gemma2-9b-it').doGenerate({
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
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/groq/0.0.0-test`,
    );
  });

  it('should pass response format information as json_schema when structuredOutputs enabled by default', async () => {
    prepareJsonFixtureResponse('groq-text');

    const model = provider('gemma2-9b-it');

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
        "model": "gemma2-9b-it",
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

  it('should pass response format information as json_object when structuredOutputs explicitly disabled', async () => {
    prepareJsonFixtureResponse('groq-text');

    const model = provider('gemma2-9b-it');

    const { warnings } = await model.doGenerate({
      providerOptions: {
        groq: {
          structuredOutputs: false,
        },
      },
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
        "model": "gemma2-9b-it",
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

  it('should use json_schema format when structuredOutputs explicitly enabled', async () => {
    prepareJsonFixtureResponse('groq-text');

    const model = provider('gemma2-9b-it');

    await model.doGenerate({
      providerOptions: {
        groq: {
          structuredOutputs: true,
        },
      },
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
        "model": "gemma2-9b-it",
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

  it('should allow explicit structuredOutputs override', async () => {
    prepareJsonFixtureResponse('groq-text');

    const model = provider('gemma2-9b-it');

    await model.doGenerate({
      providerOptions: {
        groq: {
          structuredOutputs: true,
        },
      },
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
        "model": "gemma2-9b-it",
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

  it('should send strict: false when strictJsonSchema is explicitly disabled', async () => {
    prepareJsonFixtureResponse('groq-text');

    const model = provider('gemma2-9b-it');

    await model.doGenerate({
      providerOptions: {
        groq: {
          strictJsonSchema: false,
        },
      },
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
        "model": "gemma2-9b-it",
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

  it('should handle structured outputs with Kimi K2 model', async () => {
    prepareJsonFixtureResponse('groq-text');

    const kimiModel = provider('moonshotai/kimi-k2-instruct-0905');

    await kimiModel.doGenerate({
      providerOptions: {
        groq: {
          structuredOutputs: true,
        },
      },
      responseFormat: {
        type: 'json',
        name: 'recipe_response',
        description: 'A recipe with ingredients and instructions',
        schema: {
          type: 'object',
          properties: {
            recipe: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } },
                instructions: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'ingredients', 'instructions'],
            },
          },
          required: ['recipe'],
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
      },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a simple pasta recipe' }],
        },
      ],
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": "Generate a simple pasta recipe",
            "role": "user",
          },
        ],
        "model": "moonshotai/kimi-k2-instruct-0905",
        "response_format": {
          "json_schema": {
            "description": "A recipe with ingredients and instructions",
            "name": "recipe_response",
            "schema": {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "additionalProperties": false,
              "properties": {
                "recipe": {
                  "properties": {
                    "ingredients": {
                      "items": {
                        "type": "string",
                      },
                      "type": "array",
                    },
                    "instructions": {
                      "items": {
                        "type": "string",
                      },
                      "type": "array",
                    },
                    "name": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "name",
                    "ingredients",
                    "instructions",
                  ],
                  "type": "object",
                },
              },
              "required": [
                "recipe",
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

  it('should include warnings when structured outputs explicitly disabled but schema provided', async () => {
    prepareJsonFixtureResponse('groq-text');

    const { warnings } = await model.doGenerate({
      providerOptions: {
        groq: {
          structuredOutputs: false,
        },
      },
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

  it('should send request body', async () => {
    prepareJsonFixtureResponse('groq-text');

    const { request } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": "{"model":"gemma2-9b-it","messages":[{"role":"user","content":"Hello"}]}",
      }
    `);
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
      prepareChunksFixtureResponse('groq-text');
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
      prepareChunksFixtureResponse('groq-tool-call');
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
      prepareChunksFixtureResponse('groq-reasoning');
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

  it('should stream tool call deltas when tool call arguments are passed in the first chunk', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"va"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"lue"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}],` +
          `"x_groq":{"id":"req_01jadadp0femyae9kav1gpkhe8","usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}}\n\n`,
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
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "gemma2-9b-it",
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_tokens": 439,
              "prompt_tokens": 18,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should not duplicate tool calls when there is an additional empty chunk after the tool call has been completed', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
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

  it('should stream tool call that is sent in one chunk', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1711357598,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\"value\\":\\"Sparkle Day\\"}"}}]},` +
          `"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798","object":"chat.completion.chunk","created":1729171479,"model":"gemma2-9b-it",` +
          `"system_fingerprint":"fp_10c08bf97d","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}],` +
          `"x_groq":{"id":"req_01jadadp0femyae9kav1gpkhe8","usage":{"queue_time":0.061348671,"prompt_tokens":18,"prompt_time":0.000211569,` +
          `"completion_tokens":439,"completion_time":0.798181818,"total_tokens":457,"total_time":0.798393387}}}\n\n`,
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
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "chatcmpl-e7f8e220-656c-4455-a132-dacfc1370798",
          "modelId": "gemma2-9b-it",
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
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": 18,
              "total": 18,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 439,
              "total": 439,
            },
            "raw": {
              "completion_tokens": 439,
              "prompt_tokens": 18,
              "total_tokens": 457,
            },
          },
        },
      ]
    `);
  });

  it('should handle error stream parts', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message": "The server had an error processing your request. Sorry about that!","type":"invalid_request_error"}}\n\n`,
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
          "error": {
            "message": "The server had an error processing your request. Sorry about that!",
            "type": "invalid_request_error",
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
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [`data: {unparsable}\n\n`, 'data: [DONE]\n\n'],
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

  it('should expose the raw response headers', async () => {
    prepareChunksFixtureResponse('groq-text', {
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

  it('should send correct streaming request body', async () => {
    prepareChunksFixtureResponse('groq-text');

    await model.doStream({
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
        "model": "gemma2-9b-it",
        "stream": true,
      }
    `);
  });

  it('should pass headers', async () => {
    prepareChunksFixtureResponse('groq-text');

    const provider = createGroq({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider('gemma2-9b-it').doStream({
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

  it('should send request body', async () => {
    prepareChunksFixtureResponse('groq-text');

    const { request } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(request).toMatchInlineSnapshot(`
      {
        "body": "{"model":"gemma2-9b-it","messages":[{"role":"user","content":"Hello"}],"stream":true}",
      }
    `);
  });
});

describe('doStream with raw chunks', () => {
  it('should stream raw chunks when includeRawChunks is true', async () => {
    server.urls[CHAT_COMPLETIONS_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gemma2-9b-it","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-456","object":"chat.completion.chunk","created":1234567890,"model":"gemma2-9b-it","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-789","object":"chat.completion.chunk","created":1234567890,"model":"gemma2-9b-it","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"x_groq":{"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}}\n\n`,
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
                },
                "finish_reason": null,
                "index": 0,
              },
            ],
            "created": 1234567890,
            "id": "chatcmpl-123",
            "model": "gemma2-9b-it",
            "object": "chat.completion.chunk",
          },
          "type": "raw",
        },
        {
          "id": "chatcmpl-123",
          "modelId": "gemma2-9b-it",
          "timestamp": 2009-02-13T23:31:30.000Z,
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
                "delta": {
                  "content": " world",
                },
                "finish_reason": null,
                "index": 0,
              },
            ],
            "created": 1234567890,
            "id": "chatcmpl-456",
            "model": "gemma2-9b-it",
            "object": "chat.completion.chunk",
          },
          "type": "raw",
        },
        {
          "delta": " world",
          "id": "txt-0",
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
            "id": "chatcmpl-789",
            "model": "gemma2-9b-it",
            "object": "chat.completion.chunk",
            "x_groq": {
              "usage": {
                "completion_tokens": 5,
                "prompt_tokens": 10,
                "total_tokens": 15,
              },
            },
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
