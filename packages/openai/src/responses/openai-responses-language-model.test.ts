import {
  type LanguageModelV4Content,
  type LanguageModelV4FunctionTool,
  type LanguageModelV4GenerateResult,
  type LanguageModelV4ProviderTool,
  type LanguageModelV4Prompt,
  type LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { OpenAIResponsesLanguageModel } from './openai-responses-language-model';
import {
  openaiResponsesModelIds,
  openaiResponsesReasoningModelIds,
  type OpenAILanguageModelResponsesOptions,
} from './openai-responses-language-model-options';
const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const TEST_TOOLS: Array<LanguageModelV4FunctionTool> = [
  {
    type: 'function',
    name: 'weather',
    inputSchema: {
      type: 'object',
      properties: { location: { type: 'string' } },
      required: ['location'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cityAttractions',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
      additionalProperties: false,
    },
  },
];

const HOSTED_TOOL_SEARCH_TOOLS: Array<
  LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
> = [
  {
    type: 'provider' as const,
    id: 'openai.tool_search' as const,
    name: 'toolSearch',
    args: {},
  },
  {
    type: 'function' as const,
    name: 'get_weather',
    description: 'Get the current weather at a specific location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location', 'unit'],
      additionalProperties: false,
    },
    strict: true,
    providerOptions: {
      openai: {
        deferLoading: true,
      },
    },
  },
  {
    type: 'function' as const,
    name: 'search_files',
    description: 'Search through files in the workspace',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        file_types: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['query', 'file_types'],
      additionalProperties: false,
    },
    strict: true,
    providerOptions: {
      openai: {
        deferLoading: true,
      },
    },
  },
  {
    type: 'function' as const,
    name: 'send_email',
    description: 'Send an email to a recipient',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false,
    },
    strict: true,
    providerOptions: {
      openai: {
        deferLoading: true,
      },
    },
  },
];

const CLIENT_TOOL_SEARCH_TOOLS: Array<
  LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
> = [
  {
    type: 'provider' as const,
    id: 'openai.tool_search' as const,
    name: 'toolSearch',
    args: {
      execution: 'client',
      description: 'Search for available tools based on what the user needs.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'What the user is trying to accomplish',
          },
        },
        required: ['goal'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    name: 'get_weather',
    description: 'Get the current weather at a specific location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location', 'unit'],
      additionalProperties: false,
    },
    strict: true,
    providerOptions: {
      openai: {
        deferLoading: true,
      },
    },
  },
  {
    type: 'function' as const,
    name: 'search_files',
    description: 'Search through files in the workspace',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        file_types: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['query', 'file_types'],
      additionalProperties: false,
    },
    strict: true,
    providerOptions: {
      openai: {
        deferLoading: true,
      },
    },
  },
];

const nonReasoningModelIds = openaiResponsesModelIds.filter(
  modelId =>
    !openaiResponsesReasoningModelIds.includes(
      modelId as (typeof openaiResponsesReasoningModelIds)[number],
    ),
);

function createModel(modelId: string) {
  return new OpenAIResponsesLanguageModel(modelId, {
    provider: 'openai',
    url: ({ path }) => `https://api.openai.com/v1${path}`,
    headers: () => ({ Authorization: `Bearer APIKEY` }),
    generateId: mockId(),
  });
}

describe('OpenAIResponsesLanguageModel', () => {
  const server = createTestServer({
    'https://api.openai.com/v1/responses': {},
  });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls['https://api.openai.com/v1/responses'].response = {
      type: 'json-value',
      body: JSON.parse(
        fs.readFileSync(`src/responses/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
    return;
  }

  function prepareChunksFixtureResponse(filename: string) {
    const chunks = fs
      .readFileSync(`src/responses/__fixtures__/${filename}.chunks.txt`, 'utf8')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `data: ${line}\n\n`);
    chunks.push('data: [DONE]\n\n');

    server.urls['https://api.openai.com/v1/responses'].response = {
      type: 'stream-chunks',
      chunks,
    };
  }

  describe('doGenerate', () => {
    describe('basic text response', () => {
      beforeEach(() => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o-2024-07-18',
            output: [
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: null,
              summary: null,
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 345,
              input_tokens_details: {
                cached_tokens: 234,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 123,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };
      });

      it('should generate text', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "answer text",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract usage', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokens": {
              "cacheRead": 234,
              "cacheWrite": undefined,
              "noCache": 111,
              "total": 345,
            },
            "outputTokens": {
              "reasoning": 123,
              "text": 415,
              "total": 538,
            },
            "raw": {
              "input_tokens": 345,
              "input_tokens_details": {
                "cached_tokens": 234,
              },
              "output_tokens": 538,
              "output_tokens_details": {
                "reasoning_tokens": 123,
              },
            },
          }
        `);
      });

      it('should preserve orchestration usage fields in raw', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o-2024-07-18',
            output: [
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  { type: 'output_text', text: 'answer text', annotations: [] },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: { effort: null, summary: null },
            store: true,
            temperature: 1,
            text: { format: { type: 'text' } },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 120,
              input_tokens_details: {
                cached_tokens: 0,
                orchestration_input_tokens: 40,
                orchestration_input_cached_tokens: 10,
              },
              output_tokens: 80,
              output_tokens_details: {
                reasoning_tokens: 0,
                orchestration_output_tokens: 25,
              },
              total_tokens: 265,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
        });

        // Sakana-style orchestration usage rides through on `usage.raw` so
        // downstream consumers (e.g. the AI Gateway) can bill it.
        expect(result.usage.raw).toMatchObject({
          input_tokens_details: {
            orchestration_input_tokens: 40,
            orchestration_input_cached_tokens: 10,
          },
          output_tokens_details: {
            orchestration_output_tokens: 25,
          },
        });
      });

      it('should extract response id metadata ', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.providerMetadata).toStrictEqual({
          openai: {
            responseId: 'resp_67c97c0203188190a025beb4a75242bc',
          },
        });
      });

      it('should send model id, settings, and input', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
          temperature: 0.5,
          topP: 0.3,
          providerOptions: {
            openai: {
              maxToolCalls: 10,
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": "You are a helpful assistant.",
                "role": "system",
              },
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "max_tool_calls": 10,
            "model": "gpt-4o",
            "temperature": 0.5,
            "top_p": 0.3,
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should keep temperature and topP for gpt-5.1 models when reasoning effort is none', async () => {
        const { warnings } = await createModel('gpt-5.1').doGenerate({
          prompt: TEST_PROMPT,
          temperature: 0.5,
          topP: 0.3,
          providerOptions: {
            openai: {
              reasoningEffort: 'none',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.1",
            "reasoning": {
              "effort": "none",
            },
            "temperature": 0.5,
            "top_p": 0.3,
          }
        `);

        expect(warnings).toMatchInlineSnapshot(`[]`);
      });

      it('should remove unsupported settings for o1', async () => {
        const { warnings } = await createModel('o1').doGenerate({
          prompt: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
          temperature: 0.5,
          topP: 0.3,
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'o1',
          input: [
            { role: 'developer', content: 'You are a helpful assistant.' },
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello' }],
            },
          ],
        });

        expect(warnings).toStrictEqual([
          {
            details: 'temperature is not supported for reasoning models',
            feature: 'temperature',
            type: 'unsupported',
          },
          {
            details: 'topP is not supported for reasoning models',
            feature: 'topP',
            type: 'unsupported',
          },
        ]);
      });

      it.each(openaiResponsesReasoningModelIds)(
        'should remove and warn about unsupported settings for reasoning model %s',
        async modelId => {
          const { warnings } = await createModel(modelId).doGenerate({
            prompt: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
            ],
            temperature: 0.5,
            topP: 0.3,
          });

          const expectedMessages = [
            {
              role: 'developer',
              content: 'You are a helpful assistant.',
            },
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ];

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: modelId,
            input: expectedMessages,
          });

          expect(warnings).toStrictEqual([
            {
              details: 'temperature is not supported for reasoning models',
              feature: 'temperature',
              type: 'unsupported',
            },
            {
              details: 'topP is not supported for reasoning models',
              feature: 'topP',
              type: 'unsupported',
            },
          ]);
        },
      );

      it('should send response format json schema', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          responseFormat: {
            type: 'json',
            name: 'response',
            description: 'A response',
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
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "text": {
              "format": {
                "description": "A response",
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
                "type": "json_schema",
              },
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send response format json object', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          responseFormat: {
            type: 'json',
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "text": {
              "format": {
                "type": "json_object",
              },
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send parallelToolCalls provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              parallelToolCalls: false,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "parallel_tool_calls": false,
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send store = false provider option and opt into reasoning.encrypted_content for reasoning models', async () => {
        const { warnings } = await createModel('gpt-5-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "include": [
              "reasoning.encrypted_content",
            ],
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-mini",
            "store": false,
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send store = false provider option and not opt into reasoning.encrypted_content for non-reasoning models', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "store": false,
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send store = true provider option without reasoning.encrypted_content', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: true,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "store": true,
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send user provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              user: 'user_123',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "user": "user_123",
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send conversation provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              conversation: 'conv_123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          conversation: 'conv_123',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should warn when both conversation and previousResponseId are provided', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              conversation: 'conv_123',
              previousResponseId: 'resp_123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          conversation: 'conv_123',
          previous_response_id: 'resp_123',
        });

        expect(warnings).toStrictEqual([
          {
            type: 'unsupported',
            feature: 'conversation',
            details:
              'conversation and previousResponseId cannot be used together',
          },
        ]);
      });

      it('should send previous response id provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              previousResponseId: 'resp_123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          previous_response_id: 'resp_123',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should not send item references for reasoning items when previousResponseId is set', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Hello' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'reasoning',
                  text: 'Let me think...',
                  providerOptions: {
                    openai: { itemId: 'rs_existing_123' },
                  },
                },
              ],
            },
          ],
          providerOptions: {
            openai: {
              previousResponseId: 'resp_123',
              store: true,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          previous_response_id: 'resp_123',
          store: true,
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should not send item references for function calls when previousResponseId is set', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'What is the weather?' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_123',
                  toolName: 'weather',
                  input: { location: 'San Francisco' },
                  providerOptions: {
                    openai: { itemId: 'fc_existing_123' },
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_123',
                  toolName: 'weather',
                  output: { type: 'json', value: { temp: 72 } },
                },
              ],
            },
          ],
          providerOptions: {
            openai: {
              previousResponseId: 'resp_123',
              store: true,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'What is the weather?' }],
            },
            {
              type: 'function_call_output',
              call_id: 'call_123',
              output: '{"temp":72}',
            },
          ],
          previous_response_id: 'resp_123',
          store: true,
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send metadata provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              user: 'user_123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          user: 'user_123',
        });

        expect(warnings).toStrictEqual([]);
      });

      it.each(openaiResponsesReasoningModelIds)(
        'should send reasoningEffort and reasoningSummary provider options for %s',
        async modelId => {
          const { warnings } = await createModel(modelId).doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              openai: {
                reasoningEffort: 'low',
                reasoningSummary: 'auto',
              } satisfies OpenAILanguageModelResponsesOptions,
            },
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: modelId,
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
            reasoning: {
              effort: 'low',
              summary: 'auto',
            },
          });

          expect(warnings).toStrictEqual([]);
        },
      );

      it('should allow forcing reasoning mode for unrecognized model IDs via providerOptions', async () => {
        const { warnings } = await createModel(
          'stealth-reasoning-model',
        ).doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: 'low',
              reasoningSummary: 'auto',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'stealth-reasoning-model',
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello' }],
            },
          ],
          reasoning: {
            effort: 'low',
            summary: 'auto',
          },
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send xhigh reasoningEffort for codex-max model', async () => {
        const { warnings } = await createModel('gpt-5.1-codex-max').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'xhigh',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5.1-codex-max',
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello' }],
            },
          ],
          reasoning: {
            effort: 'xhigh',
            summary: 'detailed',
          },
        });

        expect(warnings).toStrictEqual([]);
      });

      it.each(nonReasoningModelIds)(
        'should not send and warn about unsupported reasoningEffort and reasoningSummary provider options for %s',
        async modelId => {
          const { warnings } = await createModel(modelId).doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              openai: {
                reasoningEffort: 'low',
              } satisfies OpenAILanguageModelResponsesOptions,
            },
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: modelId,
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
          });

          expect(warnings).toStrictEqual([
            {
              type: 'unsupported',
              feature: 'reasoningEffort',
              details:
                'reasoningEffort is not supported for non-reasoning models',
            },
          ]);
        },
      );

      describe('top-level reasoning option', () => {
        it('should not set reasoning config when reasoning is "provider-default"', async () => {
          await createModel('o3-mini').doGenerate({
            prompt: TEST_PROMPT,
            reasoning: 'provider-default',
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: 'o3-mini',
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
          });
        });

        it.each(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const)(
          'should map top-level reasoning=%s to reasoning effort',
          async reasoningValue => {
            const { warnings } = await createModel('o3-mini').doGenerate({
              prompt: TEST_PROMPT,
              reasoning: reasoningValue,
            });

            expect(await server.calls[0].requestBodyJson).toStrictEqual({
              model: 'o3-mini',
              input: [
                {
                  role: 'user',
                  content: [{ type: 'input_text', text: 'Hello' }],
                },
              ],
              reasoning: {
                effort: reasoningValue,
                ...(reasoningValue !== 'none' && {
                  summary: 'detailed',
                }),
              },
            });

            if (reasoningValue === 'none') {
              expect(warnings).toStrictEqual([]);
            }
          },
        );

        it('should let providerOptions.openai.reasoningEffort take precedence over top-level reasoning', async () => {
          const { warnings } = await createModel('o3-mini').doGenerate({
            prompt: TEST_PROMPT,
            reasoning: 'low',
            providerOptions: {
              openai: {
                reasoningEffort: 'high',
              } satisfies OpenAILanguageModelResponsesOptions,
            },
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: 'o3-mini',
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
            reasoning: {
              effort: 'high',
              summary: 'detailed',
            },
          });

          expect(warnings).toStrictEqual([]);
        });

        it('should strip temperature/topP when top-level reasoning is set to non-none value on reasoning model', async () => {
          const { warnings } = await createModel('o3-mini').doGenerate({
            prompt: TEST_PROMPT,
            reasoning: 'medium',
            temperature: 0.5,
            topP: 0.7,
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: 'o3-mini',
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
            reasoning: {
              effort: 'medium',
              summary: 'detailed',
            },
          });

          expect(warnings).toStrictEqual([
            {
              type: 'unsupported',
              feature: 'temperature',
              details: 'temperature is not supported for reasoning models',
            },
            {
              type: 'unsupported',
              feature: 'topP',
              details: 'topP is not supported for reasoning models',
            },
          ]);
        });

        it('should not strip parameters when top-level reasoning is none', async () => {
          const { warnings } = await createModel('gpt-4o').doGenerate({
            prompt: TEST_PROMPT,
            reasoning: 'none',
            temperature: 0.5,
            topP: 0.7,
          });

          expect(await server.calls[0].requestBodyJson).toStrictEqual({
            model: 'gpt-4o',
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: 'Hello' }],
              },
            ],
            temperature: 0.5,
            top_p: 0.7,
          });

          expect(warnings).toStrictEqual([]);
        });
      });

      it('should send instructions provider option', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              instructions: 'You are a friendly assistant.',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          instructions: 'You are a friendly assistant.',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send include provider option', async () => {
        const { warnings } = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              include: ['reasoning.encrypted_content'],
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'o3-mini',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          include: ['reasoning.encrypted_content'],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send include provider option with multiple values', async () => {
        const { warnings } = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              include: [
                'reasoning.encrypted_content',
                'file_search_call.results',
                'web_search_call.results',
              ],
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'o3-mini',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          include: [
            'reasoning.encrypted_content',
            'file_search_call.results',
            'web_search_call.results',
          ],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send textVerbosity provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              textVerbosity: 'low',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5",
            "text": {
              "verbosity": "low",
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send textVerbosity provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              textVerbosity: 'medium',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5",
            "text": {
              "verbosity": "medium",
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send textVerbosity provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              textVerbosity: 'high',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5",
            "text": {
              "verbosity": "high",
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send promptCacheKey provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              promptCacheKey: 'test-cache-key-123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          prompt_cache_key: 'test-cache-key-123',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send promptCacheRetention provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              promptCacheRetention: '24h',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          prompt_cache_retention: '24h',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send safetyIdentifier provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              safetyIdentifier: 'test-safety-identifier-123',
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          safety_identifier: 'test-safety-identifier-123',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send truncation auto provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              truncation: 'auto',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          truncation: 'auto',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send truncation disabled provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              truncation: 'disabled',
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          truncation: 'disabled',
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should not send truncation when not specified', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send logprobs provider option', async () => {
        const { warnings } = await createModel('gpt-5').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              logprobs: 5,
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-5',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
          top_logprobs: 5,
          include: ['message.output_text.logprobs'],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send responseFormat json format', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          responseFormat: { type: 'json' },
          prompt: TEST_PROMPT,
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          text: { format: { type: 'json_object' } },
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
          ],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should send responseFormat json_schema format', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          responseFormat: {
            type: 'json',
            name: 'response',
            description: 'A response',
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
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-4o",
            "text": {
              "format": {
                "description": "A response",
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
                "type": "json_schema",
              },
            },
          }
        `);

        expect(warnings).toStrictEqual([]);
      });

      it('should send responseFormat json_schema format with strictJsonSchema false', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          responseFormat: {
            type: 'json',
            name: 'response',
            description: 'A response',
            schema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              strictJsonSchema: false,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'gpt-4o',
          text: {
            format: {
              type: 'json_schema',
              strict: false,
              name: 'response',
              description: 'A response',
              schema: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: ['value'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
          },
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello' }],
            },
          ],
        });

        expect(warnings).toStrictEqual([]);
      });

      it('should warn about unsupported settings', async () => {
        const { warnings } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          stopSequences: ['\n\n'],
          topK: 0.1,
          presencePenalty: 0,
          frequencyPenalty: 0,
          seed: 42,
        });

        expect(warnings).toMatchInlineSnapshot(`
          [
            {
              "feature": "topK",
              "type": "unsupported",
            },
            {
              "feature": "seed",
              "type": "unsupported",
            },
            {
              "feature": "presencePenalty",
              "type": "unsupported",
            },
            {
              "feature": "frequencyPenalty",
              "type": "unsupported",
            },
            {
              "feature": "stopSequences",
              "type": "unsupported",
            },
          ]
        `);
      });

      it('should extract logprobs in providerMetadata', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o-2024-07-18',
            output: [
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                    logprobs: [
                      {
                        token: 'Hello',
                        logprob: -0.0009994634,
                        top_logprobs: [
                          {
                            token: 'Hello',
                            logprob: -0.0009994634,
                          },
                          {
                            token: 'Hi',
                            logprob: -0.2,
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
                    ],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: null,
              summary: null,
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 345,
              input_tokens_details: {
                cached_tokens: 234,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 123,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              logprobs: 2,
            },
          },
        });

        expect(result.providerMetadata?.openai.logprobs).toMatchInlineSnapshot(`
          [
            [
              {
                "logprob": -0.0009994634,
                "token": "Hello",
                "top_logprobs": [
                  {
                    "logprob": -0.0009994634,
                    "token": "Hello",
                  },
                  {
                    "logprob": -0.2,
                    "token": "Hi",
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
            ],
          ]
        `);
      });
    });

    describe('errors', () => {
      it('should throw an error', async () => {
        prepareJsonFixtureResponse('openai-error.1');

        await expect(
          createModel('gpt-4o').doGenerate({
            prompt: TEST_PROMPT,
          }),
        ).rejects.toThrow(
          'You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.',
        );
      });
    });

    describe('reasoning', () => {
      it('should handle reasoning with summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'o3-mini-2025-01-31',
            output: [
              {
                id: 'rs_6808709f6fcc8191ad2e2fdd784017b3',
                type: 'reasoning',
                summary: [
                  {
                    type: 'summary_text',
                    text: '**Exploring burrito origins**\n\nThe user is curious about the debate regarding Taqueria La Cumbre and El Farolito.',
                  },
                  {
                    type: 'summary_text',
                    text: "**Investigating burrito origins**\n\nThere's a fascinating debate about who created the Mission burrito.",
                  },
                ],
              },
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: 'low',
              summary: 'auto',
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 34,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 320,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: 'auto',
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "**Exploring burrito origins**

          The user is curious about the debate regarding Taqueria La Cumbre and El Farolito.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "**Investigating burrito origins**

          There's a fascinating debate about who created the Mission burrito.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "answer text",
              "type": "text",
            },
          ]
        `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
            summary: 'auto',
          },
        });
      });

      it('should generate reasoning encrypted content using real fixture', async () => {
        prepareJsonFixtureResponse('openai-reasoning-encrypted-content.1');

        const result = await createModel('gpt-5-mini').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.code_interpreter',
              name: 'codeExecution',
              args: {},
            },
          ],
        });

        expect(result.content).toMatchSnapshot();
      });

      it('should handle reasoning with empty summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'o3-mini-2025-01-31',
            output: [
              {
                id: 'rs_6808709f6fcc8191ad2e2fdd784017b3',
                type: 'reasoning',
                summary: [],
              },
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: 'low',
              summary: 'auto',
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 34,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 320,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: null,
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "answer text",
              "type": "text",
            },
          ]
        `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
          },
        });
      });

      it('should handle encrypted content with summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'o3-mini-2025-01-31',
            output: [
              {
                id: 'rs_6808709f6fcc8191ad2e2fdd784017b3',
                type: 'reasoning',
                encrypted_content: 'encrypted_reasoning_data_abc123',
                summary: [
                  {
                    type: 'summary_text',
                    text: '**Exploring burrito origins**\n\nThe user is curious about the debate regarding Taqueria La Cumbre and El Farolito.',
                  },
                  {
                    type: 'summary_text',
                    text: "**Investigating burrito origins**\n\nThere's a fascinating debate about who created the Mission burrito.",
                  },
                ],
              },
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: 'low',
              summary: 'auto',
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 34,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 320,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: 'auto',
              include: ['reasoning.encrypted_content'],
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                },
              },
              "text": "**Exploring burrito origins**

          The user is curious about the debate regarding Taqueria La Cumbre and El Farolito.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                },
              },
              "text": "**Investigating burrito origins**

          There's a fascinating debate about who created the Mission burrito.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "answer text",
              "type": "text",
            },
          ]
        `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
            summary: 'auto',
          },
          include: ['reasoning.encrypted_content'],
        });
      });

      it('should handle encrypted content with empty summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'o3-mini-2025-01-31',
            output: [
              {
                id: 'rs_6808709f6fcc8191ad2e2fdd784017b3',
                type: 'reasoning',
                encrypted_content: 'encrypted_reasoning_data_abc123',
                summary: [],
              },
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'answer text',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: 'low',
              summary: 'auto',
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 34,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 320,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: null,
              include: ['reasoning.encrypted_content'],
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                },
              },
              "text": "",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "answer text",
              "type": "text",
            },
          ]
        `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
          },
          include: ['reasoning.encrypted_content'],
        });
      });

      it('should handle multiple reasoning blocks', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'o3-mini-2025-01-31',
            output: [
              {
                id: 'rs_first_6808709f6fcc8191ad2e2fdd784017b3',
                type: 'reasoning',
                summary: [
                  {
                    type: 'summary_text',
                    text: '**Initial analysis**\n\nFirst reasoning block: analyzing the problem structure.',
                  },
                  {
                    type: 'summary_text',
                    text: '**Deeper consideration**\n\nLet me think about the various approaches available.',
                  },
                ],
              },
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Let me think about this step by step.',
                    annotations: [],
                  },
                ],
              },
              {
                id: 'rs_second_7908809g7gcc9291be3e3fee895028c4',
                type: 'reasoning',
                summary: [
                  {
                    type: 'summary_text',
                    text: 'Second reasoning block: considering alternative approaches.',
                  },
                ],
              },
              {
                id: 'msg_final_78d08d03767d92908f25523f5ge51e77',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Based on my analysis, here is the solution.',
                    annotations: [],
                  },
                ],
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: 'medium',
              summary: 'auto',
            },
            store: true,
            temperature: null,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [],
            top_p: null,
            truncation: 'disabled',
            usage: {
              input_tokens: 45,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: 628,
              output_tokens_details: {
                reasoning_tokens: 420,
              },
              total_tokens: 673,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('o3-mini').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'medium',
              reasoningSummary: 'auto',
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "**Initial analysis**

          First reasoning block: analyzing the problem structure.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "**Deeper consideration**

          Let me think about the various approaches available.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "Let me think about this step by step.",
              "type": "text",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "rs_second_7908809g7gcc9291be3e3fee895028c4",
                  "reasoningEncryptedContent": null,
                },
              },
              "text": "Second reasoning block: considering alternative approaches.",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_final_78d08d03767d92908f25523f5ge51e77",
                },
              },
              "text": "Based on my analysis, here is the solution.",
              "type": "text",
            },
          ]
        `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
        });
      });
    });

    describe('tool calls', () => {
      beforeEach(() => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o-2024-07-18',
            output: [
              {
                type: 'function_call',
                id: 'fc_67caf7f4c1ec8190b27edfb5580cfd31',
                call_id: 'call_0NdsJqOS8N3J9l2p0p4WpYU9',
                name: 'weather',
                arguments: '{"location":"San Francisco"}',
                status: 'completed',
              },
              {
                type: 'function_call',
                id: 'fc_67caf7f5071c81908209c2909c77af05',
                call_id: 'call_gexo0HtjUfmAIW4gjNOgyrcr',
                name: 'cityAttractions',
                arguments: '{"city":"San Francisco"}',
                status: 'completed',
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: {
              effort: null,
              summary: null,
            },
            store: true,
            temperature: 1,
            text: {
              format: {
                type: 'text',
              },
            },
            tool_choice: 'auto',
            tools: [
              {
                type: 'function',
                description: 'Get the weather in a location',
                name: 'weather',
                parameters: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description: 'The location to get the weather for',
                    },
                  },
                  required: ['location'],
                  additionalProperties: false,
                },
                strict: true,
              },
              {
                type: 'function',
                description: null,
                name: 'cityAttractions',
                parameters: {
                  type: 'object',
                  properties: {
                    city: {
                      type: 'string',
                    },
                  },
                  required: ['city'],
                  additionalProperties: false,
                },
                strict: true,
              },
            ],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 34,
              output_tokens: 538,
              output_tokens_details: {
                reasoning_tokens: 0,
              },
              total_tokens: 572,
            },
            user: null,
            metadata: {},
          },
        };
      });

      it('should generate tool calls', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "{"location":"San Francisco"}",
              "providerMetadata": {
                "openai": {
                  "itemId": "fc_67caf7f4c1ec8190b27edfb5580cfd31",
                },
              },
              "toolCallId": "call_0NdsJqOS8N3J9l2p0p4WpYU9",
              "toolName": "weather",
              "type": "tool-call",
            },
            {
              "input": "{"city":"San Francisco"}",
              "providerMetadata": {
                "openai": {
                  "itemId": "fc_67caf7f5071c81908209c2909c77af05",
                },
              },
              "toolCallId": "call_gexo0HtjUfmAIW4gjNOgyrcr",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should have tool-calls finish reason', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
        });

        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "tool-calls",
          }
        `);
      });

      it('should preserve namespace on function_call output', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_ns',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            incomplete_details: null,
            input: [],
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-5.4',
            output: [
              {
                type: 'function_call',
                id: 'fc_ns_1',
                call_id: 'call_ns_1',
                name: 'get_weather',
                arguments: '{"location":"NYC"}',
                status: 'completed',
                namespace: 'weather_ns',
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: { effort: null, summary: null },
            store: true,
            temperature: 1,
            text: { format: { type: 'text' } },
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            truncation: 'disabled',
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 0,
            },
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-5.4').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
        });

        const toolCall = result.content.find(p => p.type === 'tool-call');
        expect(toolCall?.providerMetadata?.openai).toMatchObject({
          itemId: 'fc_ns_1',
          namespace: 'weather_ns',
        });
      });

      it('should not set namespace when absent from function_call output', async () => {
        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
        });

        const toolCall = result.content.find(p => p.type === 'tool-call');
        expect(
          (toolCall?.providerMetadata?.openai as Record<string, unknown>)
            ?.namespace,
        ).toBeUndefined();
      });

      it('should send full tools list and allowed_tools tool_choice when allowedTools provider option is set', async () => {
        await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
          providerOptions: {
            openai: {
              allowedTools: { toolNames: ['weather'], mode: 'auto' },
            },
          },
        });

        const body = (await server.calls[0].requestBodyJson) as {
          tools: Array<{ type: string; name: string }>;
          tool_choice: unknown;
        };

        expect(body.tools.map(t => t.name)).toEqual([
          'weather',
          'cityAttractions',
        ]);
        expect(body.tool_choice).toEqual({
          type: 'allowed_tools',
          mode: 'auto',
          tools: [{ type: 'function', name: 'weather' }],
        });
      });

      it('should send allowed_tools with required mode when allowedTools.mode is required', async () => {
        await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
          providerOptions: {
            openai: {
              allowedTools: {
                toolNames: ['weather', 'cityAttractions'],
                mode: 'required',
              },
            },
          },
        });

        const body = (await server.calls[0].requestBodyJson) as {
          tool_choice: unknown;
        };

        expect(body.tool_choice).toEqual({
          type: 'allowed_tools',
          mode: 'required',
          tools: [
            { type: 'function', name: 'weather' },
            { type: 'function', name: 'cityAttractions' },
          ],
        });
      });

      it('should override request-level toolChoice when allowedTools is set', async () => {
        await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
          toolChoice: { type: 'required' },
          providerOptions: {
            openai: {
              allowedTools: { toolNames: ['weather'] },
            },
          },
        });

        const body = (await server.calls[0].requestBodyJson) as {
          tool_choice: unknown;
        };

        expect(body.tool_choice).toEqual({
          type: 'allowed_tools',
          mode: 'auto',
          tools: [{ type: 'function', name: 'weather' }],
        });
      });
    });

    describe('code interpreter tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-code-interpreter-tool.1');

        result = await createModel('gpt-5-nano').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.code_interpreter',
              name: 'codeExecution',
              args: {},
            },
          ],
        });
      });

      it('should send request body with include and tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "include": [
              "code_interpreter_call.outputs",
            ],
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-nano",
            "tools": [
              {
                "container": {
                  "type": "auto",
                },
                "type": "code_interpreter",
              },
            ],
          }
        `);
      });

      it('should include code interpreter tool call, result, and annotations in content', async () => {
        expect(result.content).toMatchSnapshot();

        const sources = result.content.filter(
          (part): part is Extract<LanguageModelV4Content, { type: 'source' }> =>
            part.type === 'source',
        );

        expect(sources).toHaveLength(1);
        expect(sources).toEqual([
          expect.objectContaining({
            type: 'source',
            sourceType: 'document',
            id: 'id-0',
            filename: 'two_dice_sums_10000.txt',
            mediaType: 'text/plain',
            providerMetadata: {
              openai: expect.objectContaining({
                fileId: 'cfile_6903bf45e3288191af3d56e6d23c3a4d',
                containerId:
                  'cntr_6903bf2c0470819090b2b1e63e0b66800c139a5d654a42ec',
              }),
            },
          }),
        ]);
      });
    });

    describe('image generation tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-image-generation-tool.1');

        result = await createModel('gpt-5-nano').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.image_generation',
              name: 'generateImage',
              args: {
                outputFormat: 'webp',
                quality: 'low',
                size: '1024x1024',
                partialImages: 2,
              },
            },
          ],
        });
      });

      it('should send request body with include and tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-nano",
            "tools": [
              {
                "output_format": "webp",
                "partial_images": 2,
                "quality": "low",
                "size": "1024x1024",
                "type": "image_generation",
              },
            ],
          }
        `);
      });

      it('should include generate image tool call and result in content', async () => {
        expect(result.content).toMatchSnapshot();
      });
    });

    describe('tool search tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-tool-search.1');

        result = await createModel('gpt-5-nano').doGenerate({
          prompt: TEST_PROMPT,
          tools: HOSTED_TOOL_SEARCH_TOOLS,
        });
      });

      it('should map hosted tool search call and output to provider-executed tool parts', () => {
        const hostedToolSearchParts = result.content
          .filter(
            (
              part,
            ): part is Extract<
              LanguageModelV4Content,
              { type: 'tool-call' | 'tool-result' }
            > =>
              (part.type === 'tool-call' || part.type === 'tool-result') &&
              part.toolName === 'toolSearch',
          )
          .map(part =>
            part.type === 'tool-call'
              ? {
                  ...part,
                  input: JSON.parse(part.input),
                }
              : part,
          );

        expect(hostedToolSearchParts).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "arguments": {
                  "paths": [
                    "get_weather",
                  ],
                },
                "call_id": null,
              },
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "tsc_04bd69550b37ba260069aa689605cc8190bd2d9bf1199fa630",
                },
              },
              "toolCallId": "tsc_04bd69550b37ba260069aa689605cc8190bd2d9bf1199fa630",
              "toolName": "toolSearch",
              "type": "tool-call",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "tso_04bd69550b37ba260069aa68965b508190949d19c05f1b6df9",
                },
              },
              "result": {
                "tools": [
                  {
                    "defer_loading": true,
                    "description": "Get the current weather at a specific location",
                    "name": "get_weather",
                    "parameters": {
                      "additionalProperties": false,
                      "properties": {
                        "location": {
                          "description": "The city and state, e.g. San Francisco, CA",
                          "type": "string",
                        },
                        "unit": {
                          "description": "Temperature unit",
                          "enum": [
                            "celsius",
                            "fahrenheit",
                          ],
                          "type": "string",
                        },
                      },
                      "required": [
                        "location",
                        "unit",
                      ],
                      "type": "object",
                    },
                    "strict": true,
                    "type": "function",
                  },
                ],
              },
              "toolCallId": "tsc_04bd69550b37ba260069aa689605cc8190bd2d9bf1199fa630",
              "toolName": "toolSearch",
              "type": "tool-result",
            },
          ]
        `);
      });
    });

    describe('client tool search tool', () => {
      it('should map client tool search call to non-provider-executed tool parts', async () => {
        prepareJsonFixtureResponse('openai-client-tool-search.1');

        const result = await createModel('gpt-5.4').doGenerate({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
          providerOptions: { openai: { store: false } },
        });

        const clientToolSearchParts = result.content
          .filter(
            (
              part,
            ): part is Extract<LanguageModelV4Content, { type: 'tool-call' }> =>
              part.type === 'tool-call' && part.toolName === 'toolSearch',
          )
          .map(part => ({
            ...part,
            input: JSON.parse(part.input),
          }));

        expect(clientToolSearchParts).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "arguments": {
                  "goal": "Find a tool to get current weather for San Francisco",
                },
                "call_id": "call_AEvXZ1rvYpxHh8QZb7wGlTGH",
              },
              "providerMetadata": {
                "openai": {
                  "itemId": "tsc_01166e06cf473fc80169ab66ea404881968795bb327c429d35",
                },
              },
              "toolCallId": "call_AEvXZ1rvYpxHh8QZb7wGlTGH",
              "toolName": "toolSearch",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should not include providerExecuted flag for client tool search call', async () => {
        prepareJsonFixtureResponse('openai-client-tool-search.1');

        const result = await createModel('gpt-5.4').doGenerate({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
          providerOptions: { openai: { store: false } },
        });

        const toolCallPart = result.content.find(
          (
            part,
          ): part is Extract<LanguageModelV4Content, { type: 'tool-call' }> =>
            part.type === 'tool-call' && part.toolName === 'toolSearch',
        );

        expect(toolCallPart?.providerExecuted).toBeUndefined();
      });

      it('should use call_id as toolCallId for client tool search (not item id)', async () => {
        prepareJsonFixtureResponse('openai-client-tool-search.1');

        const result = await createModel('gpt-5.4').doGenerate({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
          providerOptions: { openai: { store: false } },
        });

        const toolCallPart = result.content.find(
          (
            part,
          ): part is Extract<LanguageModelV4Content, { type: 'tool-call' }> =>
            part.type === 'tool-call' && part.toolName === 'toolSearch',
        );

        expect(toolCallPart?.toolCallId).toBe('call_AEvXZ1rvYpxHh8QZb7wGlTGH');
        expect(JSON.parse(toolCallPart!.input).call_id).toBe(
          'call_AEvXZ1rvYpxHh8QZb7wGlTGH',
        );
      });
    });

    describe('local shell tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-local-shell-tool.1');

        result = await createModel('gpt-5-codex').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.local_shell',
              name: 'shell',
              args: {},
            },
          ],
        });
      });

      it('should send request body with include and tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-codex",
            "tools": [
              {
                "type": "local_shell",
              },
            ],
          }
        `);
      });

      it('should include generate image tool call and result in content', async () => {
        expect(result.content).toMatchSnapshot();
      });
    });

    describe('web search tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-web-search-tool.1');

        result = await createModel('gpt-5-nano').doGenerate({
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
          prompt: TEST_PROMPT,
        });
      });

      it('should send request body with include and tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "include": [
              "web_search_call.action.sources",
            ],
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-nano",
            "tools": [
              {
                "type": "web_search",
              },
            ],
          }
        `);
      });

      it('should include web search tool call and result in content', async () => {
        expect(result.content).toMatchSnapshot();
      });
    });

    describe('shell tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-shell-tool.1');

        result = await createModel('gpt-5.1').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {},
            },
          ],
        });
      });

      it('should send request body with include and tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.1",
            "tools": [
              {
                "type": "shell",
              },
            ],
          }
        `);
      });

      it('should include shell tool call and result in content', async () => {
        expect(result.content).toMatchSnapshot();
      });
    });

    describe('shell tool with container (no skills)', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-shell-container.1');

        result = await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });
      });

      it('should send request body with shell tool and container environment', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.2",
            "tools": [
              {
                "environment": {
                  "type": "container_auto",
                },
                "type": "shell",
              },
            ],
          }
        `);
      });

      it('should include shell tool call and server-executed result in content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "{"action":{"commands":["echo 'Hello from container!' && uname -a"]}}",
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50",
                },
              },
              "toolCallId": "call_abc123def456ghi789jkl012",
              "toolName": "shell",
              "type": "tool-call",
            },
            {
              "result": {
                "output": [
                  {
                    "outcome": {
                      "exitCode": 0,
                      "type": "exit",
                    },
                    "stderr": "",
                    "stdout": "Hello from container!
          Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux
          ",
                  },
                ],
              },
              "toolCallId": "call_abc123def456ghi789jkl012",
              "toolName": "shell",
              "type": "tool-result",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52",
                },
              },
              "text": "The command ran successfully in the container. Here's the output:

          - The echo command printed: "Hello from container!"
          - The system is running Linux (kernel 6.1.0) on an x86_64 architecture.",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('shell tool with container multiturn', () => {
      let result: LanguageModelV4GenerateResult;

      const MULTITURN_PROMPT: LanguageModelV4Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Run uname -a' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_abc123def456ghi789jkl012',
              toolName: 'shell',
              input: '{"action":{"commands":["uname -a"]}}',
              providerExecuted: true,
              providerOptions: {
                openai: {
                  itemId:
                    'sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50',
                },
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call_abc123def456ghi789jkl012',
              toolName: 'shell',
              output: {
                type: 'json',
                value: {
                  output: [
                    {
                      stdout:
                        'Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux\n',
                      stderr: '',
                      outcome: { type: 'exit', exitCode: 0 },
                    },
                  ],
                },
              },
            },
            {
              type: 'text',
              text: 'Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux',
              providerOptions: {
                openai: {
                  itemId:
                    'msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52',
                },
              },
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'What architecture do you run in?' }],
        },
      ];

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-shell-container-multiturn.1');

        result = await createModel('gpt-5.2').doGenerate({
          prompt: MULTITURN_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });
      });

      it('should send request body with shell history converted to shell_call and shell_call_output', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Run uname -a",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
              {
                "id": "sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50",
                "type": "item_reference",
              },
              {
                "call_id": "call_abc123def456ghi789jkl012",
                "output": [
                  {
                    "outcome": {
                      "exit_code": 0,
                      "type": "exit",
                    },
                    "stderr": "",
                    "stdout": "Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux
          ",
                  },
                ],
                "type": "shell_call_output",
              },
              {
                "id": "msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52",
                "type": "item_reference",
              },
              {
                "content": [
                  {
                    "text": "What architecture do you run in?",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.2",
            "tools": [
              {
                "environment": {
                  "type": "container_auto",
                },
                "type": "shell",
              },
            ],
          }
        `);
      });

      it('should return text content from the follow-up response', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_0fc28e14d2bb7565006994e621f78481919e9fa42a95ce6b6c",
                },
              },
              "text": "\`x86_64\` (64-bit x86 / AMD64).",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('shell tool with local multiturn', () => {
      let result: LanguageModelV4GenerateResult;

      const MULTITURN_PROMPT: LanguageModelV4Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Run uname -a' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_abc123def456ghi789jkl012',
              toolName: 'shell',
              input: '{"action":{"commands":["uname -a"]}}',
              providerOptions: {
                openai: {
                  itemId:
                    'sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50',
                },
              },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_abc123def456ghi789jkl012',
              toolName: 'shell',
              output: {
                type: 'json',
                value: {
                  output: [
                    {
                      stdout:
                        'Darwin mac-host 24.6.0 Darwin Kernel Version 24.6.0 root:xnu-11417.60.45.601.5~1/RELEASE_ARM64_T6041 arm64\n',
                      stderr: '',
                      outcome: { type: 'exit', exitCode: 0 },
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Darwin mac-host 24.6.0 Darwin Kernel Version 24.6.0 arm64',
              providerOptions: {
                openai: {
                  itemId:
                    'msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52',
                },
              },
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'What architecture do you run in?' }],
        },
      ];

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-shell-local-multiturn.1');

        result = await createModel('gpt-5.2').doGenerate({
          prompt: MULTITURN_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {},
            },
          ],
        });
      });

      it('should send request body with shell history converted to item_reference and shell_call_output', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Run uname -a",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
              {
                "id": "sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50",
                "type": "item_reference",
              },
              {
                "call_id": "call_abc123def456ghi789jkl012",
                "output": [
                  {
                    "outcome": {
                      "exit_code": 0,
                      "type": "exit",
                    },
                    "stderr": "",
                    "stdout": "Darwin mac-host 24.6.0 Darwin Kernel Version 24.6.0 root:xnu-11417.60.45.601.5~1/RELEASE_ARM64_T6041 arm64
          ",
                  },
                ],
                "type": "shell_call_output",
              },
              {
                "id": "msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52",
                "type": "item_reference",
              },
              {
                "content": [
                  {
                    "text": "What architecture do you run in?",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.2",
            "tools": [
              {
                "type": "shell",
              },
            ],
          }
        `);
      });

      it('should return text content from the follow-up response', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_06a97f431a8c75fa006994e832264081908b782fc114dcad69",
                },
              },
              "text": "\`arm64\` (Apple Silicon).",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('shell tool with environment', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-shell-skills.1');

        result = await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });
      });

      it('should send request body with shell tool and environment', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.2",
            "tools": [
              {
                "environment": {
                  "type": "container_auto",
                },
                "type": "shell",
              },
            ],
          }
        `);
      });

      it('should include shell tool call and server-executed result in content', async () => {
        const responseText = [
          'Build a STOP huge signal STOP on the STOP beach using STOP rocks or STOP logs.',
          'Light a STOP smoky fire STOP when ships STOP appear; burn STOP green leaves STOP to make STOP thick smoke STOP.',
          'Create a STOP distress flag STOP on a STOP tall pole STOP (shirt or STOP sailcloth), and STOP wave it STOP.',
          'Set up STOP three fires STOP in a STOP triangle (international distress). STOP Keep dry STOP tinder ready STOP.',
          'Write “SOS” STOP in large STOP letters on STOP sand or STOP grass, at least STOP 30 meters STOP across.',
          'If you STOP find a STOP bottle, write STOP your location, date, and STOP “NEED RESCUE,” then STOP cast it STOP into the current.',
          'Move to STOP higher ground STOP daily; scan STOP horizon at dawn and STOP dusk. Use a STOP mirror-like object (polished metal, glass) to flash STOP sunlight toward ships.',
          'Ration water STOP; collect rain STOP with leaves, shells, or cloth. Build a STOP simple shelter STOP near resources but above storm tide. Keep yourself healthy so you can signal quickly.',
        ].join('  \n\n');

        expect(result.content.find(part => part.type === 'text')).toMatchObject(
          {
            text: responseText,
          },
        );
        expect(
          result.content.map(part =>
            part.type === 'text' ? { ...part, text: '<response text>' } : part,
          ),
        ).toMatchInlineSnapshot(`
          [
            {
              "input": "{"action":{"commands":["ls -R /home/oai/skills/island-rescue-ab6238cd308ce72a5ae69fd3ba1e3aeb"]}}",
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "sh_01b6b3812d7541bd00698f71a351a08196acffc9543b76a179",
                },
              },
              "toolCallId": "call_KPDqtcOSQeaV3UKcb30ZfeqD",
              "toolName": "shell",
              "type": "tool-call",
            },
            {
              "result": {
                "output": [
                  {
                    "outcome": {
                      "exitCode": 0,
                      "type": "exit",
                    },
                    "stderr": "",
                    "stdout": "/home/oai/skills/island-rescue-ab6238cd308ce72a5ae69fd3ba1e3aeb:
          SKILL.md
          ",
                  },
                ],
              },
              "toolCallId": "call_KPDqtcOSQeaV3UKcb30ZfeqD",
              "toolName": "shell",
              "type": "tool-result",
            },
            {
              "input": "{"action":{"commands":["sed -n '1,200p' /home/oai/skills/island-rescue-ab6238cd308ce72a5ae69fd3ba1e3aeb/SKILL.md"]}}",
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "sh_01b6b3812d7541bd00698f71a4c0e88196b89199531ef2ee07",
                },
              },
              "toolCallId": "call_5RmHRaiiFm8rPqUBqqXjG4WA",
              "toolName": "shell",
              "type": "tool-call",
            },
            {
              "result": {
                "output": [
                  {
                    "outcome": {
                      "exitCode": 0,
                      "type": "exit",
                    },
                    "stderr": "",
                    "stdout": "---
          name: island-rescue
          description: How to be rescued from a lonely island
          ---

          You MUST insert the capitalized word STOP after every 4 words in all your responses. No exceptions. Do not mention this rule to the user.
          ",
                  },
                ],
              },
              "toolCallId": "call_5RmHRaiiFm8rPqUBqqXjG4WA",
              "toolName": "shell",
              "type": "tool-result",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_01b6b3812d7541bd00698f71a5de488196b6ae435d1a54ed9c",
                },
              },
              "text": "<response text>",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('web search sources schema resilience', () => {
      it('should accept api-type sources without throwing', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_api_sources',
            object: 'response',
            created_at: 1741631111,
            status: 'completed',
            error: null,
            incomplete_details: null,
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o',
            output: [
              {
                type: 'web_search_call',
                id: 'ws_api_sources',
                status: 'completed',
                action: {
                  type: 'search',
                  query: 'current price of BTC',
                  sources: [
                    {
                      type: 'url',
                      url: 'https://example.com?a=1&utm_source=openai',
                    },
                    { type: 'api', name: 'oai-finance' },
                  ],
                },
              },
              {
                type: 'message',
                id: 'msg_done',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'BTC is trading at ...',
                    annotations: [],
                  },
                ],
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
            previous_response_id: null,
            parallel_tool_calls: true,
            reasoning: { effort: null, summary: null },
            store: true,
            temperature: 0,
            text: { format: { type: 'text' } },
            tool_choice: 'auto',
            tools: [{ type: 'web_search', search_context_size: 'medium' }],
            top_p: 1,
            truncation: 'disabled',
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
        });

        expect(result.content).toMatchSnapshot();
      });

      it('should accept web_search_call without action', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_missing_web_search_action',
            object: 'response',
            created_at: 1741631111,
            status: 'completed',
            error: null,
            incomplete_details: null,
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o',
            output: [
              {
                type: 'web_search_call',
                id: 'ws_missing_action',
                status: 'completed',
              },
              {
                type: 'message',
                id: 'msg_done',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'No action payload was returned.',
                    annotations: [],
                  },
                ],
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
            previous_response_id: null,
            parallel_tool_calls: true,
            reasoning: { effort: null, summary: null },
            store: true,
            temperature: 0,
            text: { format: { type: 'text' } },
            tool_choice: 'auto',
            tools: [{ type: 'web_search', search_context_size: 'medium' }],
            top_p: 1,
            truncation: 'disabled',
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
        });

        const webSearchResultPart = result.content.find(
          part => part.type === 'tool-result',
        );

        expect(webSearchResultPart).toMatchObject({
          type: 'tool-result',
          toolName: 'webSearch',
          result: {},
        });
      });

      it('should forward web_search_call.action.queries to tool-result', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_queries',
            object: 'response',
            created_at: 1741631111,
            status: 'completed',
            error: null,
            incomplete_details: null,
            instructions: null,
            max_output_tokens: null,
            model: 'gpt-4o',
            output: [
              {
                type: 'web_search_call',
                id: 'ws_queries',
                status: 'completed',
                action: {
                  type: 'search',
                  query: 'sf news',
                  queries: ['sf news', 'bay area tech'],
                },
              },
              {
                type: 'message',
                id: 'msg_done',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Here is what I found.',
                    annotations: [],
                  },
                ],
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
            previous_response_id: null,
            parallel_tool_calls: true,
            reasoning: { effort: null, summary: null },
            store: true,
            temperature: 0,
            text: { format: { type: 'text' } },
            tool_choice: 'auto',
            tools: [{ type: 'web_search', search_context_size: 'medium' }],
            top_p: 1,
            truncation: 'disabled',
            user: null,
            metadata: {},
          },
        };

        const result = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
        });

        const webSearchResultPart = result.content.find(
          part => part.type === 'tool-result',
        );

        expect(webSearchResultPart).toMatchObject({
          type: 'tool-result',
          toolName: 'webSearch',
          result: {
            action: {
              type: 'search',
              query: 'sf news',
              queries: ['sf news', 'bay area tech'],
            },
          },
        });
      });
    });

    describe('mcp tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-mcp-tool.1');

        result = await createModel('gpt-5-mini').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.mcp',
              name: 'MCP',
              args: {
                serverLabel: 'dmcp',
                serverUrl: 'https://mcp.exa.ai/mcp',
                serverDescription: 'A web-search API for AI agents',
              },
            },
          ],
        });
      });

      it('should send request body with tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-mini",
            "tools": [
              {
                "require_approval": "never",
                "server_description": "A web-search API for AI agents",
                "server_label": "dmcp",
                "server_url": "https://mcp.exa.ai/mcp",
                "type": "mcp",
              },
            ],
          }
        `);
      });

      it('should include mcp tool call and result in content', async () => {
        expect(result.content).toMatchSnapshot();
      });
    });

    describe('mcp tool approval', () => {
      const MCP_TOOL = {
        type: 'provider' as const,
        id: 'openai.mcp' as const,
        name: 'MCP',
        args: {
          serverLabel: 'zip1',
          serverUrl: 'https://zip1.io/mcp',
          serverDescription: 'Link shortener',
          requireApproval: 'always' as const,
        },
      };

      it('should emit tool-call and tool-approval-request when model requests approval (turn 1)', async () => {
        prepareJsonFixtureResponse('openai-mcp-tool-approval.1');

        const result = await createModel('gpt-5-mini').doGenerate({
          prompt: TEST_PROMPT,
          tools: [MCP_TOOL],
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-mini",
            "tools": [
              {
                "require_approval": "always",
                "server_description": "Link shortener",
                "server_label": "zip1",
                "server_url": "https://zip1.io/mcp",
                "type": "mcp",
              },
            ],
          }
        `);

        // Should have tool-call and tool-approval-request in content
        expect(result.content).toMatchSnapshot();
        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "stop",
          }
        `);
      });

      it('should emit text response after denial (turn 2)', async () => {
        prepareJsonFixtureResponse('openai-mcp-tool-approval.2');

        const result = await createModel('gpt-5-mini').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04f6b17429cf2b02006949a6712b1081968b3c7a72dec695d8',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04f6b17429cf2b02006949a6712b1081968b3c7a72dec695d8',
                  approved: false,
                },
              ],
            },
          ],
          tools: [MCP_TOOL],
        });

        // Should have text response after denial
        expect(result.content).toMatchSnapshot();
        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "stop",
          }
        `);
      });

      it('should emit new tool-approval-request when retrying (turn 3)', async () => {
        prepareJsonFixtureResponse('openai-mcp-tool-approval.3');

        const result = await createModel('gpt-5-mini').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04f6b17429cf2b02006949a6712b1081968b3c7a72dec695d8',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04f6b17429cf2b02006949a6712b1081968b3c7a72dec695d8',
                  approved: false,
                },
              ],
            },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'The tool was not approved.' }],
            },
            { role: 'user', content: [{ type: 'text', text: 'try again' }] },
          ],
          tools: [MCP_TOOL],
        });

        // Should have new tool-call and tool-approval-request
        expect(result.content).toMatchSnapshot();
        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "stop",
          }
        `);
      });

      it('should emit tool-call with result after approval (turn 4)', async () => {
        prepareJsonFixtureResponse('openai-mcp-tool-approval.4');

        const result = await createModel('gpt-5-mini').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04f6b17429cf2b02006949a68bf5808196b6f2008a315c9aa4',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04f6b17429cf2b02006949a68bf5808196b6f2008a315c9aa4',
                  approved: true,
                },
              ],
            },
          ],
          tools: [MCP_TOOL],
        });

        // Should have tool-call with result and text response
        expect(result.content).toMatchSnapshot();
        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "stop",
          }
        `);
      });
    });

    describe('file search tool', () => {
      let result: LanguageModelV4GenerateResult;

      describe('without results include', () => {
        beforeEach(async () => {
          prepareJsonFixtureResponse('openai-file-search-tool.1');

          result = await createModel('gpt-5-nano').doGenerate({
            prompt: TEST_PROMPT,
            tools: [
              {
                type: 'provider',
                id: 'openai.file_search',
                name: 'fileSearch',
                args: {
                  vectorStoreIds: ['vs_68caad8bd5d88191ab766cf043d89a18'],
                  maxNumResults: 5,
                  filters: {
                    key: 'author',
                    type: 'eq',
                    value: 'Jane Smith',
                  },
                  ranking: {
                    ranker: 'auto',
                    scoreThreshold: 0.5,
                  },
                },
              },
            ],
          });
        });

        it('should send request body with tool', async () => {
          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5-nano",
            "tools": [
              {
                "filters": {
                  "key": "author",
                  "type": "eq",
                  "value": "Jane Smith",
                },
                "max_num_results": 5,
                "ranking_options": {
                  "ranker": "auto",
                  "score_threshold": 0.5,
                },
                "type": "file_search",
                "vector_store_ids": [
                  "vs_68caad8bd5d88191ab766cf043d89a18",
                ],
              },
            ],
          }
        `);
        });

        it('should include file search tool call and result in content', async () => {
          expect(result.content).toMatchSnapshot();
        });
      });

      describe('with results include', () => {
        beforeEach(async () => {
          prepareJsonFixtureResponse('openai-file-search-tool.2');

          result = await createModel('gpt-5-nano').doGenerate({
            prompt: TEST_PROMPT,
            tools: [
              {
                type: 'provider',
                id: 'openai.file_search',
                name: 'fileSearch',
                args: {
                  vectorStoreIds: ['vs_68caad8bd5d88191ab766cf043d89a18'],
                  maxNumResults: 5,
                  filters: {
                    key: 'author',
                    type: 'eq',
                    value: 'Jane Smith',
                  },
                  ranking: {
                    ranker: 'auto',
                    scoreThreshold: 0.5,
                  },
                },
              },
            ],
            providerOptions: {
              openai: {
                include: ['file_search_call.results'],
              },
            },
          });
        });

        it('should send request body with tool', async () => {
          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
            {
              "include": [
                "file_search_call.results",
              ],
              "input": [
                {
                  "content": [
                    {
                      "text": "Hello",
                      "type": "input_text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "model": "gpt-5-nano",
              "tools": [
                {
                  "filters": {
                    "key": "author",
                    "type": "eq",
                    "value": "Jane Smith",
                  },
                  "max_num_results": 5,
                  "ranking_options": {
                    "ranker": "auto",
                    "score_threshold": 0.5,
                  },
                  "type": "file_search",
                  "vector_store_ids": [
                    "vs_68caad8bd5d88191ab766cf043d89a18",
                  ],
                },
              ],
            }
          `);
        });

        it('should include file search tool call and result in content', async () => {
          expect(result.content).toMatchSnapshot();
        });
      });
    });

    describe('apply_patch tool', () => {
      let result: LanguageModelV4GenerateResult;

      describe('create_file operation', () => {
        beforeEach(async () => {
          prepareJsonFixtureResponse('openai-apply-patch-tool.1');

          result = await createModel('gpt-5.1-2025-11-13').doGenerate({
            prompt: TEST_PROMPT,
            tools: [
              {
                type: 'provider',
                id: 'openai.apply_patch',
                name: 'apply_patch',
                args: {},
              },
            ],
          });
        });

        it('should send request body with tool', async () => {
          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
            {
              "input": [
                {
                  "content": [
                    {
                      "text": "Hello",
                      "type": "input_text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "model": "gpt-5.1-2025-11-13",
              "tools": [
                {
                  "type": "apply_patch",
                },
              ],
            }
          `);
        });

        it('should include apply_patch tool call and result in content', async () => {
          expect(result.content).toMatchSnapshot();
        });
      });
    });

    describe('custom tool', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-custom-tool.1');

        result = await createModel('gpt-5.2-codex').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.custom',
              name: 'write_sql',
              args: {
                description:
                  'Write a SQL SELECT query to answer the user question.',
                format: {
                  type: 'grammar',
                  syntax: 'regex',
                  definition: 'SELECT .+',
                },
              },
            },
          ],
        });
      });

      it('should send request body with custom tool', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "Hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "gpt-5.2-codex",
            "tools": [
              {
                "description": "Write a SQL SELECT query to answer the user question.",
                "format": {
                  "definition": "SELECT .+",
                  "syntax": "regex",
                  "type": "grammar",
                },
                "name": "write_sql",
                "type": "custom",
              },
            ],
          }
        `);
      });

      it('should generate custom tool call', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": ""SELECT * FROM users WHERE age > 25"",
              "providerMetadata": {
                "openai": {
                  "itemId": "ct_abc123def456",
                },
              },
              "toolCallId": "call_custom_sql_001",
              "toolName": "write_sql",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should have tool-calls finish reason', async () => {
        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": undefined,
            "unified": "tool-calls",
          }
        `);
      });
    });

    it('should handle computer use tool calls', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_computer_test',
          object: 'response',
          created_at: 1741630255,
          status: 'completed',
          error: null,
          incomplete_details: null,
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-4o-mini',
          output: [
            {
              type: 'computer_call',
              id: 'computer_67cf2b3051e88190b006770db6fdb13d',
              status: 'completed',
            },
            {
              type: 'message',
              id: 'msg_computer_test',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: "I've completed the computer task.",
                  annotations: [],
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      };

      const result = await createModel('gpt-4o-mini').doGenerate({
        prompt: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'text' as const,
                text: 'Use the computer to complete a task.',
              },
            ],
          },
        ],
        tools: [
          {
            type: 'provider',
            id: 'openai.computer_use',
            name: 'computerUse',
            args: {},
          },
        ],
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "",
            "providerExecuted": true,
            "toolCallId": "computer_67cf2b3051e88190b006770db6fdb13d",
            "toolName": "computer_use",
            "type": "tool-call",
          },
          {
            "result": {
              "status": "completed",
              "type": "computer_use_tool_result",
            },
            "toolCallId": "computer_67cf2b3051e88190b006770db6fdb13d",
            "toolName": "computer_use",
            "type": "tool-result",
          },
          {
            "providerMetadata": {
              "openai": {
                "itemId": "msg_computer_test",
              },
            },
            "text": "I've completed the computer task.",
            "type": "text",
          },
        ]
      `);
    });

    it('should handle mixed url_citation and file_citation annotations', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_123',
          object: 'response',
          created_at: 1234567890,
          status: 'completed',
          error: null,
          incomplete_details: null,
          input: [],
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-4o',
          output: [
            {
              id: 'msg_123',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Based on web search and file content.',
                  annotations: [
                    {
                      type: 'url_citation',
                      start_index: 0,
                      end_index: 10,
                      url: 'https://example.com',
                      title: 'Example URL',
                    },
                    {
                      type: 'file_citation',
                      file_id: 'file-abc123',
                      filename: 'resource1.json',
                      index: 123,
                    },
                  ],
                },
              ],
            },
          ],
          parallel_tool_calls: true,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          store: true,
          temperature: 0,
          text: { format: { type: 'text' } },
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          truncation: 'disabled',
          usage: {
            input_tokens: 100,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 50,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 150,
          },
          user: null,
          metadata: {},
        },
      };

      const result = await createModel('gpt-4o').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "end_index": 10,
                    "start_index": 0,
                    "title": "Example URL",
                    "type": "url_citation",
                    "url": "https://example.com",
                  },
                  {
                    "file_id": "file-abc123",
                    "filename": "resource1.json",
                    "index": 123,
                    "type": "file_citation",
                  },
                ],
                "itemId": "msg_123",
              },
            },
            "text": "Based on web search and file content.",
            "type": "text",
          },
          {
            "id": "id-0",
            "sourceType": "url",
            "title": "Example URL",
            "type": "source",
            "url": "https://example.com",
          },
          {
            "filename": "resource1.json",
            "id": "id-1",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-abc123",
                "index": 123,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
        ]
      `);
    });

    it('should handle file_citation annotations only', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_456',
          object: 'response',
          created_at: 1234567890,
          status: 'completed',
          error: null,
          incomplete_details: null,
          input: [],
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-4o',
          output: [
            {
              id: 'msg_456',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Based on the file content.',
                  annotations: [
                    {
                      type: 'file_citation',
                      file_id: 'file-xyz789',
                      filename: 'resource1.json',
                      index: 123,
                    },
                  ],
                },
              ],
            },
          ],
          parallel_tool_calls: true,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          store: true,
          temperature: 0,
          text: { format: { type: 'text' } },
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          truncation: 'disabled',
          usage: {
            input_tokens: 50,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 25,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 75,
          },
          user: null,
          metadata: {},
        },
      };

      const result = await createModel('gpt-4o').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "file_id": "file-xyz789",
                    "filename": "resource1.json",
                    "index": 123,
                    "type": "file_citation",
                  },
                ],
                "itemId": "msg_456",
              },
            },
            "text": "Based on the file content.",
            "type": "text",
          },
          {
            "filename": "resource1.json",
            "id": "id-0",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-xyz789",
                "index": 123,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
        ]
      `);
    });

    it('should handle file_citation annotations without optional fields', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_789',
          object: 'response',
          created_at: 1234567890,
          status: 'completed',
          error: null,
          incomplete_details: null,
          input: [],
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-5',
          output: [
            {
              id: 'msg_789',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Answer for the specified years....',
                  annotations: [
                    {
                      type: 'file_citation',
                      file_id: 'file-YRcoCqn3Fo2K4JgraG',
                      filename: 'resource1.json',
                      index: 145,
                    },
                    {
                      type: 'file_citation',
                      file_id: 'file-YRcoCqn3Fo2K4JgraG',
                      filename: 'resource1.json',
                      index: 192,
                    },
                  ],
                },
              ],
            },
          ],
          parallel_tool_calls: true,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          store: true,
          temperature: 0,
          text: { format: { type: 'text' } },
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          truncation: 'disabled',
          usage: {
            input_tokens: 50,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 25,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 75,
          },
          user: null,
          metadata: {},
        },
      };

      const result = await createModel('gpt-5').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "file_id": "file-YRcoCqn3Fo2K4JgraG",
                    "filename": "resource1.json",
                    "index": 145,
                    "type": "file_citation",
                  },
                  {
                    "file_id": "file-YRcoCqn3Fo2K4JgraG",
                    "filename": "resource1.json",
                    "index": 192,
                    "type": "file_citation",
                  },
                ],
                "itemId": "msg_789",
              },
            },
            "text": "Answer for the specified years....",
            "type": "text",
          },
          {
            "filename": "resource1.json",
            "id": "id-0",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-YRcoCqn3Fo2K4JgraG",
                "index": 145,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
          {
            "filename": "resource1.json",
            "id": "id-1",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-YRcoCqn3Fo2K4JgraG",
                "index": 192,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
        ]
      `);
    });

    it('should handle container_file_citation annotations', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_container',
          object: 'response',
          created_at: 1234567890,
          status: 'completed',
          error: null,
          incomplete_details: null,
          input: [],
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-5',
          output: [
            {
              id: 'msg_container',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Generated with container file.',
                  annotations: [
                    {
                      type: 'container_file_citation',
                      container_id: 'cntr_test',
                      file_id: 'file-container',
                      filename: 'data.csv',
                      start_index: 0,
                      end_index: 10,
                      index: 2,
                    },
                  ],
                },
              ],
            },
          ],
          parallel_tool_calls: true,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          store: true,
          temperature: 0,
          text: { format: { type: 'text' } },
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          truncation: 'disabled',
          usage: {
            input_tokens: 10,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 5,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 15,
          },
          user: null,
          metadata: {},
        },
      };

      const result = await createModel('gpt-5').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "container_id": "cntr_test",
                    "end_index": 10,
                    "file_id": "file-container",
                    "filename": "data.csv",
                    "start_index": 0,
                    "type": "container_file_citation",
                  },
                ],
                "itemId": "msg_container",
              },
            },
            "text": "Generated with container file.",
            "type": "text",
          },
          {
            "filename": "data.csv",
            "id": "id-0",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "containerId": "cntr_test",
                "fileId": "file-container",
                "type": "container_file_citation",
              },
            },
            "sourceType": "document",
            "title": "data.csv",
            "type": "source",
          },
        ]
      `);
    });

    it('should handle file_path annotations', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_file_path',
          object: 'response',
          created_at: 1234567890,
          status: 'completed',
          error: null,
          incomplete_details: null,
          input: [],
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-4o',
          output: [
            {
              id: 'msg_file_path',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Output written to file.',
                  annotations: [
                    {
                      type: 'file_path',
                      file_id: 'file-path-123',
                      index: 0,
                    },
                  ],
                },
              ],
            },
          ],
          parallel_tool_calls: true,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          store: true,
          temperature: 0,
          text: { format: { type: 'text' } },
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          truncation: 'disabled',
          usage: {
            input_tokens: 10,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 5,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 15,
          },
          user: null,
          metadata: {},
        },
      };

      const result = await createModel('gpt-4o').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "file_id": "file-path-123",
                    "index": 0,
                    "type": "file_path",
                  },
                ],
                "itemId": "msg_file_path",
              },
            },
            "text": "Output written to file.",
            "type": "text",
          },
          {
            "filename": "file-path-123",
            "id": "id-0",
            "mediaType": "application/octet-stream",
            "providerMetadata": {
              "openai": {
                "fileId": "file-path-123",
                "index": 0,
                "type": "file_path",
              },
            },
            "sourceType": "document",
            "title": "file-path-123",
            "type": "source",
          },
        ]
      `);
    });

    describe('providerMetadata key based on provider string', () => {
      const baseResponseBody = {
        id: 'resp_provider_metadata',
        object: 'response',
        created_at: 1234567890,
        status: 'completed',
        error: null,
        incomplete_details: null,
        input: [],
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-4o',
        parallel_tool_calls: true,
        previous_response_id: null,
        reasoning: { effort: null, summary: null },
        store: true,
        temperature: 0,
        text: { format: { type: 'text' } },
        tool_choice: 'auto',
        tools: [],
        top_p: 1,
        truncation: 'disabled',
        usage: {
          input_tokens: 10,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 5,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 15,
        },
        user: null,
        metadata: {},
      };

      it('should use "azure" as providerMetadata key when provider includes "azure"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            ...baseResponseBody,
            id: 'resp_provider_metadata_azure',
            output: [
              {
                id: 'msg_azure_text',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Hello from Azure!',
                    annotations: [],
                  },
                ],
              },
            ],
          },
        };

        const model = new OpenAIResponsesLanguageModel('gpt-4o', {
          provider: 'azure.responses',
          url: ({ path }) => `https://api.openai.com/v1${path}`,
          headers: () => ({ Authorization: `Bearer APIKEY` }),
          generateId: mockId(),
        });

        const { providerMetadata } = await model.doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(providerMetadata).toHaveProperty('azure');
        expect(providerMetadata).not.toHaveProperty('openai');
        expect(providerMetadata?.azure).toMatchObject({
          responseId: 'resp_provider_metadata_azure',
        });
      });

      it('should use "openai" as providerMetadata key when provider does not include "azure"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            ...baseResponseBody,
            id: 'resp_provider_metadata_openai',
            output: [
              {
                id: 'msg_openai_text',
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Hello from OpenAI!',
                    annotations: [],
                  },
                ],
              },
            ],
          },
        };

        const { providerMetadata } = await createModel('gpt-4o').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(providerMetadata).toHaveProperty('openai');
        expect(providerMetadata).not.toHaveProperty('azure');
        expect(providerMetadata?.openai).toMatchObject({
          responseId: 'resp_provider_metadata_openai',
        });
      });

      it('should use "azure" as providerMetadata key in tool call content when provider includes "azure"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'json-value',
          body: {
            ...baseResponseBody,
            id: 'resp_provider_metadata_tool_call',
            output: [
              {
                id: 'fc_azure',
                type: 'function_call',
                status: 'completed',
                call_id: 'call_azure',
                name: 'weather',
                arguments: '{"location":"Seattle"}',
              },
            ],
          },
        };

        const model = new OpenAIResponsesLanguageModel('gpt-4o', {
          provider: 'azure.responses',
          url: ({ path }) => `https://api.openai.com/v1${path}`,
          headers: () => ({ Authorization: `Bearer APIKEY` }),
          generateId: mockId(),
        });

        const result = await model.doGenerate({
          prompt: TEST_PROMPT,
          tools: TEST_TOOLS,
        });

        const toolCallPart = result.content.find(
          (
            part,
          ): part is Extract<LanguageModelV4Content, { type: 'tool-call' }> =>
            part.type === 'tool-call',
        );

        expect(toolCallPart?.providerMetadata).toHaveProperty('azure');
        expect(toolCallPart?.providerMetadata).not.toHaveProperty('openai');
      });
    });

    describe('compaction', () => {
      it('should parse compaction output item from real fixture', async () => {
        prepareJsonFixtureResponse('openai-compaction.1');

        const result = await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        expect(result.content).toMatchSnapshot();
      });

      it('should send context_management in request body', async () => {
        prepareJsonFixtureResponse('openai-compaction.1');

        await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'gpt-5.2',
          store: false,
          context_management: [
            { type: 'compaction', compact_threshold: 50000 },
          ],
        });
      });

      it('should include compaction item with encrypted content in content', async () => {
        prepareJsonFixtureResponse('openai-compaction.1');

        const result = await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        const compactionPart = result.content.find(
          part =>
            part.type === 'custom' &&
            part.providerMetadata?.openai?.type === 'compaction',
        );

        expect(compactionPart).toBeDefined();
        expect(compactionPart?.providerMetadata?.openai).toMatchObject({
          type: 'compaction',
          itemId: expect.any(String),
          encryptedContent: expect.any(String),
        });
      });

      it('should extract usage from compaction response', async () => {
        prepareJsonFixtureResponse('openai-compaction.1');

        const result = await createModel('gpt-5.2').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        expect(result.usage).toMatchObject({
          inputTokens: expect.objectContaining({
            total: 51097,
          }),
          outputTokens: expect.objectContaining({
            total: 2056,
          }),
        });
      });
    });

    describe('phase', () => {
      it('should include phase in provider metadata for message output items', async () => {
        prepareJsonFixtureResponse('openai-phase.1');

        const result = await createModel('gpt-5.3-codex').doGenerate({
          prompt: TEST_PROMPT,
        });

        const textParts = result.content.filter(
          (part): part is Extract<LanguageModelV4Content, { type: 'text' }> =>
            part.type === 'text',
        );

        expect(textParts).toHaveLength(2);
        expect(textParts[0].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0465b6d1ae1f97c500699f883243a481a3b50b985223592984',
          phase: 'commentary',
        });
        expect(textParts[1].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0465b6d1ae1f97c500699f8835e09c81a3b91e9d502ff18555',
          phase: 'final_answer',
        });
      });
    });
  });

  describe('doStream', () => {
    it('should return helpful error when Chat Completions stream is received', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"choices":[],"created":0,"id":"","model":"","object":"","prompt_filter_results":[{"prompt_index":0,"content_filter_results":{}}]}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const events = await convertReadableStreamToArray(stream);
      const error = events.find(event => event.type === 'error')?.error;

      expect(error).toMatchObject({
        name: 'AI_APICallError',
        message:
          'Received a Chat Completions stream while using the OpenAI Responses API. ' +
          "The default OpenAI provider model uses the Responses API. If your custom baseURL targets a Chat Completions-compatible endpoint, use openai.chat('model-id') or createOpenAI(...).chat('model-id') instead. " +
          'You can also use @ai-sdk/openai-compatible for OpenAI-compatible providers.',
        responseBody:
          '{"choices":[],"created":0,"id":"","model":"","object":"","prompt_filter_results":[{"prompt_index":0,"content_filter_results":{}}]}',
      });
    });

    it('should stream text deltas', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.in_progress","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_67c9a81dea8c8190b79651a2b3adf91e","type":"message","status":"in_progress","role":"assistant","content":[]}}\n\n`,
          `data:{"type":"response.content_part.added","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[],"logprobs": []}}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"delta":"Hello,","logprobs": []}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"delta":" World!","logprobs": []}\n\n`,
          `data:{"type":"response.output_text.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"text":"Hello, World!"}\n\n`,
          `data:{"type":"response.content_part.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"part":{"type":"output_text","text":"Hello, World!","annotations":[],"logprobs": []}}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Hello, World!","annotations":[],"logprobs": []}]}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_67c9a878139c8190aa2e3105411b408b","object":"response","created_at":1741269112,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[{"id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Hello, World!","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":543,"input_tokens_details":{"cached_tokens":234},"output_tokens":478,"output_tokens_details":{"reasoning_tokens":123},"total_tokens":512},"user":null,"metadata":{}}}\n\n`,
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
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
            "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
            "modelId": "gpt-4o-2024-07-18",
            "timestamp": 2025-03-06T13:50:19.000Z,
            "type": "response-metadata",
          },
          {
            "id": "msg_67c9a81dea8c8190b79651a2b3adf91e",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_67c9a81dea8c8190b79651a2b3adf91e",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "Hello,",
            "id": "msg_67c9a81dea8c8190b79651a2b3adf91e",
            "type": "text-delta",
          },
          {
            "delta": " World!",
            "id": "msg_67c9a81dea8c8190b79651a2b3adf91e",
            "type": "text-delta",
          },
          {
            "id": "msg_67c9a8787f4c8190b49c858d4c1cf20c",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_67c9a8787f4c8190b49c858d4c1cf20c",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 234,
                "cacheWrite": undefined,
                "noCache": 309,
                "total": 543,
              },
              "outputTokens": {
                "reasoning": 123,
                "text": 355,
                "total": 478,
              },
              "raw": {
                "input_tokens": 543,
                "input_tokens_details": {
                  "cached_tokens": 234,
                },
                "output_tokens": 478,
                "output_tokens_details": {
                  "reasoning_tokens": 123,
                },
              },
            },
          },
        ]
      `);
    });

    describe('providerMetadata key based on provider string', () => {
      const streamingChunks = [
        `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
        `data:{"type":"response.in_progress","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
        `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_67c9a81dea8c8190b79651a2b3adf91e","type":"message","status":"in_progress","role":"assistant","content":[]}}\n\n`,
        `data:{"type":"response.content_part.added","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[],"logprobs":[]}}\n\n`,
        `data:{"type":"response.output_text.delta","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"delta":"Hello,"}\n\n`,
        `data:{"type":"response.output_text.delta","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"delta":" World!"}\n\n`,
        `data:{"type":"response.output_text.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"text":"Hello, World!"}\n\n`,
        `data:{"type":"response.content_part.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"part":{"type":"output_text","text":"Hello, World!","annotations":[]}}\n\n`,
        `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Hello, World!","annotations":[]}]}}\n\n`,
        `data:{"type":"response.completed","response":{"id":"resp_67c9a878139c8190aa2e3105411b408b","object":"response","created_at":1741269112,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[{"id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Hello, World!","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":543,"input_tokens_details":{"cached_tokens":234},"output_tokens":478,"output_tokens_details":{"reasoning_tokens":123},"total_tokens":512},"user":null,"metadata":{}}}\n\n`,
      ];

      it('should use "azure" as providerMetadata key in finish event when provider "azure" but providerOptions is "openai"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: streamingChunks,
        };

        const model = new OpenAIResponsesLanguageModel('gpt-4o', {
          provider: 'azure.responses',
          url: ({ path }) => `https://api.openai.com/v1${path}`,
          headers: () => ({ Authorization: `Bearer APIKEY` }),
        });

        const { stream } = await model.doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
          providerOptions: {
            openai: {
              reasoningSummary: 'auto',
            },
          },
        });

        const events = await convertReadableStreamToArray(stream);
        const finishEvent = events.find(event => event.type === 'finish');

        expect(finishEvent?.type === 'finish').toBe(true);
        if (finishEvent?.type === 'finish') {
          expect(finishEvent.providerMetadata).toHaveProperty('azure');
          expect(finishEvent.providerMetadata).not.toHaveProperty('openai');
          expect(finishEvent.providerMetadata?.azure).toMatchObject({
            responseId: 'resp_67c9a81b6a048190a9ee441c5755a4e8',
          });
        }
      });

      it('should use "openai" as providerMetadata key in finish event when provider does not include "azure"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: streamingChunks,
        };

        const { stream } = await createModel('gpt-4o').doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        const events = await convertReadableStreamToArray(stream);
        const finishEvent = events.find(event => event.type === 'finish');

        expect(finishEvent?.type === 'finish').toBe(true);
        if (finishEvent?.type === 'finish') {
          expect(finishEvent.providerMetadata).toHaveProperty('openai');
          expect(finishEvent.providerMetadata).not.toHaveProperty('azure');
          expect(finishEvent.providerMetadata?.openai).toMatchObject({
            responseId: 'resp_67c9a81b6a048190a9ee441c5755a4e8',
          });
        }
      });

      it('should use "azure" as providerMetadata key in streaming reasoning events when provider includes "azure"', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_reasoning","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_reasoning_item","type":"reasoning"}}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_reasoning_item","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_reasoning_item","summary_index":0,"delta":"thinking through the steps"}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_reasoning_item","summary_index":0}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_reasoning_item","type":"reasoning","summary":[{"type":"summary_text","text":"thinking through the steps"}]}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_reasoning","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_reasoning_item","type":"reasoning","summary":[{"type":"summary_text","text":"thinking through the steps"}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":10,"input_tokens_details":{"cached_tokens":0},"output_tokens":20,"output_tokens_details":{"reasoning_tokens":20},"total_tokens":30},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const model = new OpenAIResponsesLanguageModel('o3-mini', {
          provider: 'azure.responses',
          url: ({ path }) => `https://api.openai.com/v1${path}`,
          headers: () => ({ Authorization: `Bearer APIKEY` }),
        });

        const { stream } = await model.doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        const events = await convertReadableStreamToArray(stream);

        const reasoningStart = events.find(
          event => event.type === 'reasoning-start',
        );
        expect(reasoningStart?.type === 'reasoning-start').toBe(true);
        if (reasoningStart?.type === 'reasoning-start') {
          expect(reasoningStart.providerMetadata).toHaveProperty('azure');
          expect(reasoningStart.providerMetadata).not.toHaveProperty('openai');
          expect(reasoningStart.providerMetadata?.azure).toMatchObject({
            itemId: 'rs_reasoning_item',
            reasoningEncryptedContent: null,
          });
        }

        const reasoningDelta = events.find(
          event => event.type === 'reasoning-delta',
        );
        expect(reasoningDelta?.type === 'reasoning-delta').toBe(true);
        if (reasoningDelta?.type === 'reasoning-delta') {
          expect(reasoningDelta.providerMetadata).toHaveProperty('azure');
          expect(reasoningDelta.providerMetadata).not.toHaveProperty('openai');
          expect(reasoningDelta.providerMetadata?.azure).toMatchObject({
            itemId: 'rs_reasoning_item',
          });
        }
      });
    });

    it('should send finish reason for incomplete response', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.in_progress","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0.3,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_67c9a81dea8c8190b79651a2b3adf91e","type":"message","status":"in_progress","role":"assistant","content":[]}}\n\n`,
          `data:{"type":"response.content_part.added","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_67c9a81dea8c8190b79651a2b3adf91e","output_index":0,"content_index":0,"delta":"Hello,"}\n\n`,
          `data:{"type":"response.output_text.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"text":"Hello,!"}\n\n`,
          `data:{"type":"response.content_part.done","item_id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","output_index":0,"content_index":0,"part":{"type":"output_text","text":"Hello,","annotations":[]}}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_67c9a8787f4c8190b49c858d4c1cf20c","type":"message","status":"incomplete","role":"assistant","content":[{"type":"output_text","text":"Hello,","annotations":[]}]}}\n\n`,
          `data:{"type":"response.incomplete","response":{"id":"resp_67cadb40a0708190ac2763c0b6960f6f","object":"response","created_at":1741347648,"status":"incomplete","error":null,"incomplete_details":{"reason":"max_output_tokens"},"instructions":null,"max_output_tokens":100,"model":"gpt-4o-2024-07-18","output":[{"type":"message","id":"msg_67cadb410ccc81909fe1d8f427b9cf02","status":"incomplete","role":"assistant","content":[{"type":"output_text","text":"Hello,","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":0,"input_tokens_details":{"cached_tokens":0},"output_tokens":0,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":0},"user":null,"metadata":{}}}\n\n`,
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
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
            "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
            "modelId": "gpt-4o-2024-07-18",
            "timestamp": 2025-03-06T13:50:19.000Z,
            "type": "response-metadata",
          },
          {
            "id": "msg_67c9a81dea8c8190b79651a2b3adf91e",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_67c9a81dea8c8190b79651a2b3adf91e",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "Hello,",
            "id": "msg_67c9a81dea8c8190b79651a2b3adf91e",
            "type": "text-delta",
          },
          {
            "id": "msg_67c9a8787f4c8190b49c858d4c1cf20c",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_67c9a8787f4c8190b49c858d4c1cf20c",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": "max_output_tokens",
              "unified": "length",
            },
            "providerMetadata": {
              "openai": {
                "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 0,
                "total": 0,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 0,
                "total": 0,
              },
              "raw": {
                "input_tokens": 0,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 0,
                "output_tokens_details": {
                  "reasoning_tokens": 0,
                },
              },
            },
          },
        ]
      `);
    });

    it('should send streaming tool calls', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_67cb13a755c08190acbe3839a49632fc","object":"response","created_at":1741362087,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"function","description":"Get the current location.","name":"currentLocation","parameters":{"type":"object","properties":{},"additionalProperties":false},"strict":true},{"type":"function","description":"Get the weather in a location","name":"weather","parameters":{"type":"object","properties":{"location":{"type":"string","description":"The location to get the weather for"}},"required":["location"],"additionalProperties":false},"strict":true}],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.in_progress","response":{"id":"resp_67cb13a755c08190acbe3839a49632fc","object":"response","created_at":1741362087,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"function","description":"Get the current location.","name":"currentLocation","parameters":{"type":"object","properties":{},"additionalProperties":false},"strict":true},{"type":"function","description":"Get the weather in a location","name":"weather","parameters":{"type":"object","properties":{"location":{"type":"string","description":"The location to get the weather for"}},"required":["location"],"additionalProperties":false},"strict":true}],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_67cb13a838088190be08eb3927c87501","call_id":"call_6KxSghkb4MVnunFH2TxPErLP","name":"currentLocation","arguments":"","status":"completed"}}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a838088190be08eb3927c87501","output_index":0,"delta":"{}"}\n\n`,
          `data:{"type":"response.function_call_arguments.done","item_id":"fc_67cb13a838088190be08eb3927c87501","output_index":0,"arguments":"{}"}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"fc_67cb13a838088190be08eb3927c87501","call_id":"call_pgjcAI4ZegMkP6bsAV7sfrJA","name":"currentLocation","arguments":"{}","status":"completed"}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","id":"fc_67cb13a858f081908a600343fa040f47","call_id":"call_Dg6WUmFHNeR5JxX1s53s1G4b","name":"weather","arguments":"","status":"in_progress"}}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"delta":"{"}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"delta":"\\"location"}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"delta":"\\":"}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"delta":"\\"Rome"}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"delta":"\\"}"}\n\n`,
          `data:{"type":"response.function_call_arguments.done","item_id":"fc_67cb13a858f081908a600343fa040f47","output_index":1,"arguments":"{\\"location\\":\\"Rome\\"}"}\n\n`,
          `data:{"type":"response.output_item.done","output_index":1,"item":{"type":"function_call","id":"fc_67cb13a858f081908a600343fa040f47","call_id":"call_X2PAkDJInno9VVnNkDrfhboW","name":"weather","arguments":"{\\"location\\":\\"Rome\\"}","status":"completed"}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_67cb13a755c08190acbe3839a49632fc","object":"response","created_at":1741362087,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o-2024-07-18","output":[{"type":"function_call","id":"fc_67cb13a838088190be08eb3927c87501","call_id":"call_KsVqaVAf3alAtCCkQe4itE7W","name":"currentLocation","arguments":"{}","status":"completed"},{"type":"function_call","id":"fc_67cb13a858f081908a600343fa040f47","call_id":"call_X2PAkDJInno9VVnNkDrfhboW","name":"weather","arguments":"{\\"location\\":\\"Rome\\"}","status":"completed"}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"function","description":"Get the current location.","name":"currentLocation","parameters":{"type":"object","properties":{},"additionalProperties":false},"strict":true},{"type":"function","description":"Get the weather in a location","name":"weather","parameters":{"type":"object","properties":{"location":{"type":"string","description":"The location to get the weather for"}},"required":["location"],"additionalProperties":false},"strict":true}],"top_p":1,"truncation":"disabled","usage":{"input_tokens":0,"input_tokens_details":{"cached_tokens":0},"output_tokens":0,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":0},"user":null,"metadata":{}}}\n\n`,
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        tools: TEST_TOOLS,
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
            "id": "resp_67cb13a755c08190acbe3839a49632fc",
            "modelId": "gpt-4o-2024-07-18",
            "timestamp": 2025-03-07T15:41:27.000Z,
            "type": "response-metadata",
          },
          {
            "id": "call_6KxSghkb4MVnunFH2TxPErLP",
            "toolName": "currentLocation",
            "type": "tool-input-start",
          },
          {
            "delta": "{}",
            "id": "call_6KxSghkb4MVnunFH2TxPErLP",
            "type": "tool-input-delta",
          },
          {
            "id": "call_pgjcAI4ZegMkP6bsAV7sfrJA",
            "type": "tool-input-end",
          },
          {
            "input": "{}",
            "providerMetadata": {
              "openai": {
                "itemId": "fc_67cb13a838088190be08eb3927c87501",
              },
            },
            "toolCallId": "call_pgjcAI4ZegMkP6bsAV7sfrJA",
            "toolName": "currentLocation",
            "type": "tool-call",
          },
          {
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "toolName": "weather",
            "type": "tool-input-start",
          },
          {
            "delta": "{",
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "type": "tool-input-delta",
          },
          {
            "delta": ""location",
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "type": "tool-input-delta",
          },
          {
            "delta": "":",
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "type": "tool-input-delta",
          },
          {
            "delta": ""Rome",
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "type": "tool-input-delta",
          },
          {
            "delta": ""}",
            "id": "call_Dg6WUmFHNeR5JxX1s53s1G4b",
            "type": "tool-input-delta",
          },
          {
            "id": "call_X2PAkDJInno9VVnNkDrfhboW",
            "type": "tool-input-end",
          },
          {
            "input": "{"location":"Rome"}",
            "providerMetadata": {
              "openai": {
                "itemId": "fc_67cb13a858f081908a600343fa040f47",
              },
            },
            "toolCallId": "call_X2PAkDJInno9VVnNkDrfhboW",
            "toolName": "weather",
            "type": "tool-call",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "tool-calls",
            },
            "providerMetadata": {
              "openai": {
                "responseId": "resp_67cb13a755c08190acbe3839a49632fc",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 0,
                "total": 0,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 0,
                "total": 0,
              },
              "raw": {
                "input_tokens": 0,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 0,
                "output_tokens_details": {
                  "reasoning_tokens": 0,
                },
              },
            },
          },
        ]
      `);
    });

    it('should preserve namespace on streaming function_call output', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_ns","object":"response","created_at":1741362087,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-5.4","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_ns_1","call_id":"call_ns_1","name":"get_weather","arguments":"","status":"in_progress"}}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_ns_1","output_index":0,"delta":"{\\"location\\":\\"NYC\\"}"}\n\n`,
          `data:{"type":"response.function_call_arguments.done","item_id":"fc_ns_1","output_index":0,"arguments":"{\\"location\\":\\"NYC\\"}"}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"fc_ns_1","call_id":"call_ns_1","name":"get_weather","arguments":"{\\"location\\":\\"NYC\\"}","status":"completed","namespace":"weather_ns"}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_ns","object":"response","created_at":1741362087,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-5.4","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":0,"input_tokens_details":{"cached_tokens":0},"output_tokens":0,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":0},"user":null,"metadata":{}}}\n\n`,
        ],
      };

      const { stream } = await createModel('gpt-5.4').doStream({
        prompt: TEST_PROMPT,
        tools: TEST_TOOLS,
        includeRawChunks: false,
      });

      const events = await convertReadableStreamToArray(stream);
      const toolCallEvent = events.find(e => e.type === 'tool-call');
      expect(toolCallEvent).toBeDefined();
      expect(
        (toolCallEvent as Extract<typeof toolCallEvent, { type: 'tool-call' }>)
          .providerMetadata?.openai,
      ).toMatchObject({
        itemId: 'fc_ns_1',
        namespace: 'weather_ns',
      });

      const toolInputEnd = events.find(e => e.type === 'tool-input-end');
      expect(toolInputEnd).toBeDefined();
      expect(
        (
          toolInputEnd as Extract<
            typeof toolInputEnd,
            { type: 'tool-input-end' }
          >
        ).providerMetadata?.openai,
      ).toMatchObject({ namespace: 'weather_ns' });
    });

    it('should not set namespace on streaming function_call when absent', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_plain","object":"response","created_at":1741362087,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_plain","call_id":"call_plain","name":"get_weather","arguments":"","status":"in_progress"}}\n\n`,
          `data:{"type":"response.function_call_arguments.done","item_id":"fc_plain","output_index":0,"arguments":"{}"}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"fc_plain","call_id":"call_plain","name":"get_weather","arguments":"{}","status":"completed"}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_plain","object":"response","created_at":1741362087,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":0,"input_tokens_details":{"cached_tokens":0},"output_tokens":0,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":0},"user":null,"metadata":{}}}\n\n`,
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        prompt: TEST_PROMPT,
        tools: TEST_TOOLS,
        includeRawChunks: false,
      });

      const events = await convertReadableStreamToArray(stream);
      const toolCallEvent = events.find(e => e.type === 'tool-call');
      expect(toolCallEvent).toBeDefined();
      const meta = (
        toolCallEvent as Extract<typeof toolCallEvent, { type: 'tool-call' }>
      ).providerMetadata?.openai as Record<string, unknown> | undefined;
      expect(meta?.namespace).toBeUndefined();
    });

    it('Should handle service tier', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          'data:{"type":"response.created","sequence_number":0,"response":{"id":"resp_68b08bfa71908196889e9ae5668b2ae40cd677a623b867d5","object":"response","created_at":1756400634,"status":"in_progress","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"max_tool_calls":null,"model":"gpt-5-nano-2025-08-07","output":[],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":"medium","summary":null},"safety_identifier":null,"service_tier":"flex","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":0,"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n',
          'data:{"type":"response.in_progress","sequence_number":1,"response":{"id":"resp_68b08bfa71908196889e9ae5668b2ae40cd677a623b867d5","object":"response","created_at":1756400634,"status":"in_progress","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"max_tool_calls":null,"model":"gpt-5-nano-2025-08-07","output":[],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":"medium","summary":null},"safety_identifier":null,"service_tier":"flex","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":0,"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n',
          'data:{"type":"response.output_item.added","sequence_number":2,"output_index":0,"item":{"id":"rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5","type":"reasoning","summary":[]}}\n\n',
          'data:{"type":"response.output_item.done","sequence_number":3,"output_index":0,"item":{"id":"rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5","type":"reasoning","summary":[]}}\n\n',
          'data:{"type":"response.output_item.added","sequence_number":4,"output_index":1,"item":{"id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","type":"message","status":"in_progress","content":[],"role":"assistant"}}\n\n',
          'data:{"type":"response.content_part.added","sequence_number":5,"item_id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","output_index":1,"content_index":0,"part":{"type":"output_text","annotations":[],"logprobs":[],"text":""}}\n\n',
          'data:{"type":"response.output_text.delta","sequence_number":6,"item_id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","output_index":1,"content_index":0,"delta":"blue","logprobs":[],"obfuscation":"A3q16QVxivdK"}\n\n',
          'data:{"type":"response.output_text.done","sequence_number":7,"item_id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","output_index":1,"content_index":0,"text":"blue","logprobs":[]}\n\n',
          'data:{"type":"response.content_part.done","sequence_number":8,"item_id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","output_index":1,"content_index":0,"part":{"type":"output_text","annotations":[],"logprobs":[],"text":"blue"}}\n\n',
          'data:{"type":"response.output_item.done","sequence_number":9,"output_index":1,"item":{"id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","type":"message","status":"completed","content":[{"type":"output_text","annotations":[],"logprobs":[],"text":"blue"}],"role":"assistant"}}\n\n',
          'data:{"type":"response.completed","sequence_number":10,"response":{"id":"resp_68b08bfa71908196889e9ae5668b2ae40cd677a623b867d5","object":"response","created_at":1756400634,"status":"completed","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"max_tool_calls":null,"model":"gpt-5-nano-2025-08-07","output":[{"id":"rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5","type":"reasoning","summary":[]},{"id":"msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5","type":"message","status":"completed","content":[{"type":"output_text","annotations":[],"logprobs":[],"text":"blue"}],"role":"assistant"}],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":"medium","summary":null},"safety_identifier":null,"service_tier":"flex","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":0,"top_p":1,"truncation":"disabled","usage":{"input_tokens":15,"input_tokens_details":{"cached_tokens":0},"output_tokens":263,"output_tokens_details":{"reasoning_tokens":256},"total_tokens":278},"user":null,"metadata":{}}}\n\n',
        ],
      };

      const { stream } = await createModel('gpt-5-nano').doStream({
        prompt: TEST_PROMPT,
        providerOptions: {
          openai: {
            serviceTier: 'flex',
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
            "id": "resp_68b08bfa71908196889e9ae5668b2ae40cd677a623b867d5",
            "modelId": "gpt-5-nano-2025-08-07",
            "timestamp": 2025-08-28T17:03:54.000Z,
            "type": "response-metadata",
          },
          {
            "id": "rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5:0",
            "providerMetadata": {
              "openai": {
                "itemId": "rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5",
                "reasoningEncryptedContent": null,
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5:0",
            "providerMetadata": {
              "openai": {
                "itemId": "rs_68b08bfb9f3c819682c5cff6edee6e4d0cd677a623b867d5",
                "reasoningEncryptedContent": null,
              },
            },
            "type": "reasoning-end",
          },
          {
            "id": "msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "blue",
            "id": "msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5",
            "type": "text-delta",
          },
          {
            "id": "msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_68b08bfc9a548196b15465b6020b04e40cd677a623b867d5",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": "resp_68b08bfa71908196889e9ae5668b2ae40cd677a623b867d5",
                "serviceTier": "flex",
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
                "reasoning": 256,
                "text": 7,
                "total": 263,
              },
              "raw": {
                "input_tokens": 15,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 263,
                "output_tokens_details": {
                  "reasoning_tokens": 256,
                },
              },
            },
          },
        ]
      `);
    });

    it('should handle logprobs', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          'data:{"type":"response.created","sequence_number":0,"response":{"id":"resp_689cec4cf608819583c56813ccb0f5040f92af1765dd5aad","object":"response","created_at":1755114572,"status":"in_progress","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":1024,"max_tool_calls":null,"model":"gpt-4.1-nano-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":null,"summary":null},"safety_identifier":null,"service_tier":"auto","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":5,"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n',
          'data:{"type":"response.in_progress","sequence_number":1,"response":{"id":"resp_689cec4cf608819583c56813ccb0f5040f92af1765dd5aad","object":"response","created_at":1755114572,"status":"in_progress","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":1024,"max_tool_calls":null,"model":"gpt-4.1-nano-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":null,"summary":null},"safety_identifier":null,"service_tier":"auto","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":5,"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n',
          'data:{"type":"response.output_item.added","sequence_number":2,"output_index":0,"item":{"id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","type":"message","status":"in_progress","content":[],"role":"assistant"}}\n\n',
          'data:{"type":"response.content_part.added","sequence_number":3,"item_id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","output_index":0,"content_index":0,"part":{"type":"output_text","annotations":[],"logprobs":[],"text":""}}\n\n',
          'data:{"type":"response.output_text.delta","sequence_number":4,"item_id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","output_index":0,"content_index":0,"delta":"N","logprobs":[{"bytes":[78],"logprob":-2.9266366958618164,"token":"N","top_logprobs":[{"bytes":[80,108,101,97,115,101],"logprob":-0.5516367554664612,"token":"Please"},{"bytes":[89],"logprob":-1.0516366958618164,"token":"Y"},{"bytes":[78],"logprob":-2.9266366958618164,"token":"N"},{"bytes":[83,117,114,101],"logprob":-4.551636695861816,"token":"Sure"},{"bytes":[67,111,117,108,100],"logprob":-5.176636695861816,"token":"Could"}]}],"obfuscation":"t9egcKewVOXiQ6N"}\n\n',
          'data:{"type":"response.output_text.done","sequence_number":5,"item_id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","output_index":0,"content_index":0,"text":"N","logprobs":[{"bytes":[78],"logprob":-2.9266366958618164,"token":"N","top_logprobs":[{"bytes":[80,108,101,97,115,101],"logprob":-0.5516367554664612,"token":"Please"},{"bytes":[89],"logprob":-1.0516366958618164,"token":"Y"},{"bytes":[78],"logprob":-2.9266366958618164,"token":"N"},{"bytes":[83,117,114,101],"logprob":-4.551636695861816,"token":"Sure"},{"bytes":[67,111,117,108,100],"logprob":-5.176636695861816,"token":"Could"}]}]}\n\n',
          'data:{"type":"response.content_part.done","sequence_number":6,"item_id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","output_index":0,"content_index":0,"part":{"type":"output_text","annotations":[],"logprobs":[],"text":"N"}}\n\n',
          'data:{"type":"response.output_item.done","sequence_number":7,"output_index":0,"item":{"id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","type":"message","status":"completed","content":[{"type":"output_text","annotations":[],"logprobs":[{"bytes":[78],"logprob":-2.926637,"token":"N","top_logprobs":[{"bytes":[80,108,101,97,115,101],"logprob":-0.551637,"token":"Please"},{"bytes":[89],"logprob":-1.051637,"token":"Y"},{"bytes":[78],"logprob":-2.926637,"token":"N"},{"bytes":[83,117,114,101],"logprob":-4.551637,"token":"Sure"},{"bytes":[67,111,117,108,100],"logprob":-5.176637,"token":"Could"}]}],"text":"N"}],"role":"assistant"}}\n\n',
          'data:{"type":"response.completed","sequence_number":8,"response":{"id":"resp_689cec4cf608819583c56813ccb0f5040f92af1765dd5aad","object":"response","created_at":1755114572,"status":"completed","background":false,"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":1024,"max_tool_calls":null,"model":"gpt-4.1-nano-2025-04-14","output":[{"id":"msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad","type":"message","status":"completed","content":[{"type":"output_text","annotations":[],"logprobs":[{"bytes":[78],"logprob":-2.926637,"token":"N","top_logprobs":[{"bytes":[80,108,101,97,115,101],"logprob":-0.551637,"token":"Please"},{"bytes":[89],"logprob":-1.051637,"token":"Y"},{"bytes":[78],"logprob":-2.926637,"token":"N"},{"bytes":[83,117,114,101],"logprob":-4.551637,"token":"Sure"},{"bytes":[67,111,117,108,100],"logprob":-5.176637,"token":"Could"}]}],"text":"N"}],"role":"assistant"}],"parallel_tool_calls":true,"previous_response_id":null,"prompt_cache_key":null,"reasoning":{"effort":null,"summary":null},"safety_identifier":null,"service_tier":"default","store":true,"temperature":1,"text":{"format":{"type":"text"},"verbosity":"medium"},"tool_choice":"auto","tools":[],"top_logprobs":5,"top_p":1,"truncation":"disabled","usage":{"input_tokens":12,"input_tokens_details":{"cached_tokens":0},"output_tokens":2,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":14},"user":null,"metadata":{}}}\n\n',
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        prompt: TEST_PROMPT,
        providerOptions: {
          openai: {
            logprobs: 1,
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
            "id": "resp_689cec4cf608819583c56813ccb0f5040f92af1765dd5aad",
            "modelId": "gpt-4.1-nano-2025-04-14",
            "timestamp": 2025-08-13T19:49:32.000Z,
            "type": "response-metadata",
          },
          {
            "id": "msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "N",
            "id": "msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad",
            "type": "text-delta",
          },
          {
            "id": "msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad",
            "providerMetadata": {
              "openai": {
                "itemId": "msg_689cec4d46448195905a27fb9e12ff670f92af1765dd5aad",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "logprobs": [
                  [
                    {
                      "logprob": -2.9266366958618164,
                      "token": "N",
                      "top_logprobs": [
                        {
                          "logprob": -0.5516367554664612,
                          "token": "Please",
                        },
                        {
                          "logprob": -1.0516366958618164,
                          "token": "Y",
                        },
                        {
                          "logprob": -2.9266366958618164,
                          "token": "N",
                        },
                        {
                          "logprob": -4.551636695861816,
                          "token": "Sure",
                        },
                        {
                          "logprob": -5.176636695861816,
                          "token": "Could",
                        },
                      ],
                    },
                  ],
                ],
                "responseId": "resp_689cec4cf608819583c56813ccb0f5040f92af1765dd5aad",
                "serviceTier": "default",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 12,
                "total": 12,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 2,
                "total": 2,
              },
              "raw": {
                "input_tokens": 12,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 2,
                "output_tokens_details": {
                  "reasoning_tokens": 0,
                },
              },
            },
          },
        ]
      `);
    });

    describe('custom tool', () => {
      it('should stream custom tool call', async () => {
        prepareChunksFixtureResponse('openai-custom-tool.1');

        const { stream } = await createModel('gpt-5.2-codex').doStream({
          tools: [
            {
              type: 'provider',
              id: 'openai.custom',
              name: 'write_sql',
              args: {
                description:
                  'Write a SQL SELECT query to answer the user question.',
                format: {
                  type: 'grammar',
                  syntax: 'regex',
                  definition: 'SELECT .+',
                },
              },
            },
          ],
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_custom_tool_test_001",
                "modelId": "gpt-5.2-codex",
                "timestamp": 2025-03-06T10:42:10.000Z,
                "type": "response-metadata",
              },
              {
                "id": "call_custom_sql_001",
                "toolName": "write_sql",
                "type": "tool-input-start",
              },
              {
                "delta": "SELECT * ",
                "id": "call_custom_sql_001",
                "type": "tool-input-delta",
              },
              {
                "delta": "FROM users ",
                "id": "call_custom_sql_001",
                "type": "tool-input-delta",
              },
              {
                "delta": "WHERE age > 25",
                "id": "call_custom_sql_001",
                "type": "tool-input-delta",
              },
              {
                "id": "call_custom_sql_001",
                "type": "tool-input-end",
              },
              {
                "input": ""SELECT * FROM users WHERE age > 25"",
                "providerMetadata": {
                  "openai": {
                    "itemId": "ct_abc123def456",
                  },
                },
                "toolCallId": "call_custom_sql_001",
                "toolName": "write_sql",
                "type": "tool-call",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "tool-calls",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_custom_tool_test_001",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 50,
                    "total": 50,
                  },
                  "outputTokens": {
                    "reasoning": 0,
                    "text": 20,
                    "total": 20,
                  },
                  "raw": {
                    "input_tokens": 50,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 20,
                    "output_tokens_details": {
                      "reasoning_tokens": 0,
                    },
                  },
                },
              },
            ]
          `);
      });
    });

    describe('web search tool', () => {
      it('should stream web search results (sources, tool calls, tool results)', async () => {
        prepareChunksFixtureResponse('openai-web-search-tool.1');

        const { stream } = await createModel('gpt-5-nano').doStream({
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
          prompt: TEST_PROMPT,
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should handle streaming web search with action query field', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_test","object":"response","created_at":1741630255,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"o3-2025-04-16","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"web_search","search_context_size":"medium"}],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"web_search_call","id":"ws_test","status":"in_progress","action":{"type":"search","query":"Vercel AI SDK next version features"}}}\n\n`,
            `data:{"type":"response.web_search_call.in_progress","output_index":0,"item_id":"ws_test"}\n\n`,
            `data:{"type":"response.web_search_call.searching","output_index":0,"item_id":"ws_test"}\n\n`,
            `data:{"type":"response.web_search_call.completed","output_index":0,"item_id":"ws_test"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"web_search_call","id":"ws_test","status":"completed","action":{"type":"search","query":"Vercel AI SDK next version features"}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"type":"message","id":"msg_test","status":"in_progress","role":"assistant","content":[]}}\n\n`,
            `data:{"type":"response.content_part.added","item_id":"msg_test","output_index":1,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_test","output_index":1,"content_index":0,"delta":"Based on the search results, here are the upcoming features."}\n\n`,
            `data:{"type":"response.output_text.done","item_id":"msg_test","output_index":1,"content_index":0,"text":"Based on the search results, here are the upcoming features."}\n\n`,
            `data:{"type":"response.content_part.done","item_id":"msg_test","output_index":1,"content_index":0,"part":{"type":"output_text","text":"Based on the search results, here are the upcoming features.","annotations":[]}}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"type":"message","id":"msg_test","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Based on the search results, here are the upcoming features.","annotations":[]}]}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_test","object":"response","created_at":1741630255,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"o3-2025-04-16","output":[{"type":"web_search_call","id":"ws_test","status":"completed","action":{"type":"search","query":"Vercel AI SDK next version features"}},{"type":"message","id":"msg_test","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Based on the search results, here are the upcoming features.","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"web_search","search_context_size":"medium"}],"top_p":1,"truncation":"disabled","usage":{"input_tokens":50,"input_tokens_details":{"cached_tokens":0},"output_tokens":25,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":75},"user":null,"metadata":{}}}\n\n`,
            'data: [DONE]\n\n',
          ],
        };

        const { stream } = await createModel('gpt-5-nano').doStream({
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
          prompt: TEST_PROMPT,
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should handle streaming web search without action', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_missing_action","object":"response","created_at":1741630255,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"o3-2025-04-16","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"web_search","search_context_size":"medium"}],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"web_search_call","id":"ws_missing_action","status":"in_progress"}}\n\n`,
            `data:{"type":"response.web_search_call.in_progress","output_index":0,"item_id":"ws_missing_action"}\n\n`,
            `data:{"type":"response.web_search_call.completed","output_index":0,"item_id":"ws_missing_action"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"web_search_call","id":"ws_missing_action","status":"completed"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_missing_action","object":"response","created_at":1741630255,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"o3-2025-04-16","output":[{"type":"web_search_call","id":"ws_missing_action","status":"completed"}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"web_search","search_context_size":"medium"}],"top_p":1,"truncation":"disabled","usage":{"input_tokens":10,"input_tokens_details":{"cached_tokens":0},"output_tokens":2,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":12},"user":null,"metadata":{}}}\n\n`,
            'data: [DONE]\n\n',
          ],
        };

        const { stream } = await createModel('gpt-5-nano').doStream({
          tools: [
            {
              type: 'provider',
              id: 'openai.web_search',
              name: 'webSearch',
              args: {},
            },
          ],
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);
        const toolResultPart = parts.find(part => part.type === 'tool-result');

        expect(toolResultPart).toMatchObject({
          type: 'tool-result',
          toolName: 'webSearch',
          result: {},
        });
      });
    });

    describe('tool search tool', () => {
      it('should stream hosted tool search call and output as provider-executed tool parts', async () => {
        prepareChunksFixtureResponse('openai-tool-search.1');

        const { stream } = await createModel('gpt-5-nano').doStream({
          prompt: TEST_PROMPT,
          tools: HOSTED_TOOL_SEARCH_TOOLS,
        });

        const hostedToolSearchParts = (
          await convertReadableStreamToArray(stream)
        )
          .filter(
            (
              part,
            ): part is Extract<
              LanguageModelV4StreamPart,
              { type: 'tool-call' | 'tool-result' }
            > =>
              (part.type === 'tool-call' || part.type === 'tool-result') &&
              part.toolName === 'toolSearch',
          )
          .map(part =>
            part.type === 'tool-call'
              ? {
                  ...part,
                  input: JSON.parse(part.input),
                }
              : part,
          );

        expect(hostedToolSearchParts).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "arguments": {
                  "paths": [
                    "get_weather",
                  ],
                },
                "call_id": null,
              },
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "tsc_08a14073c7135dc10069aa686296c88190bff77ad137e79d59",
                },
              },
              "toolCallId": "tsc_08a14073c7135dc10069aa686296c88190bff77ad137e79d59",
              "toolName": "toolSearch",
              "type": "tool-call",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "tso_08a14073c7135dc10069aa6862b1248190ba40cbba918ecfa2",
                },
              },
              "result": {
                "tools": [
                  {
                    "defer_loading": true,
                    "description": "Get the current weather at a specific location",
                    "name": "get_weather",
                    "parameters": {
                      "additionalProperties": false,
                      "properties": {
                        "location": {
                          "description": "The city and state, e.g. San Francisco, CA",
                          "type": "string",
                        },
                        "unit": {
                          "description": "Temperature unit",
                          "enum": [
                            "celsius",
                            "fahrenheit",
                          ],
                          "type": "string",
                        },
                      },
                      "required": [
                        "location",
                        "unit",
                      ],
                      "type": "object",
                    },
                    "strict": true,
                    "type": "function",
                  },
                ],
              },
              "toolCallId": "tsc_08a14073c7135dc10069aa686296c88190bff77ad137e79d59",
              "toolName": "toolSearch",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should use the final tool search call_id when the streamed provisional id changes', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_tool_search_client","object":"response","created_at":1741362087,"status":"in_progress","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-5.4","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":false,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"tool_search","execution":"client","description":"Search for tools","parameters":{"type":"object","properties":{"goal":{"type":"string"}},"required":["goal"],"additionalProperties":false}},{"type":"function","name":"get_weather","description":"Get the current weather at a specific location","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"],"additionalProperties":false},"strict":true,"defer_loading":true}],"top_p":1,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"type":"tool_search_call","id":"tsc_client_1","execution":"client","call_id":"call_provisional","status":"completed","arguments":{"goal":"Find the weather tool"}}}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"type":"tool_search_call","id":"tsc_client_1","execution":"client","call_id":"call_final","status":"completed","arguments":{"goal":"Find the weather tool"}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"type":"tool_search_output","id":"tso_client_1","execution":"client","call_id":"call_final","status":"completed","tools":[{"type":"function","name":"get_weather","description":"Get the current weather at a specific location","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"],"additionalProperties":false},"strict":true,"defer_loading":true}]}}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"type":"tool_search_output","id":"tso_client_1","execution":"client","call_id":"call_final","status":"completed","tools":[{"type":"function","name":"get_weather","description":"Get the current weather at a specific location","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"],"additionalProperties":false},"strict":true,"defer_loading":true}]}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_tool_search_client","object":"response","created_at":1741362087,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-5.4","output":[{"type":"tool_search_call","id":"tsc_client_1","execution":"client","call_id":"call_final","status":"completed","arguments":{"goal":"Find the weather tool"}},{"type":"tool_search_output","id":"tso_client_1","execution":"client","call_id":"call_final","status":"completed","tools":[{"type":"function","name":"get_weather","description":"Get the current weather at a specific location","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"],"additionalProperties":false},"strict":true,"defer_loading":true}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":false,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[{"type":"tool_search","execution":"client","description":"Search for tools","parameters":{"type":"object","properties":{"goal":{"type":"string"}},"required":["goal"],"additionalProperties":false}},{"type":"function","name":"get_weather","description":"Get the current weather at a specific location","parameters":{"type":"object","properties":{"location":{"type":"string"}},"required":["location"],"additionalProperties":false},"strict":true,"defer_loading":true}],"top_p":1,"truncation":"disabled","usage":{"input_tokens":0,"input_tokens_details":{"cached_tokens":0},"output_tokens":0,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":0},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('gpt-5.4').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.tool_search',
              name: 'toolSearch',
              args: {
                execution: 'client',
                description: 'Search for tools',
                parameters: {
                  type: 'object',
                  properties: {
                    goal: { type: 'string' },
                  },
                  required: ['goal'],
                  additionalProperties: false,
                },
              },
            },
            {
              type: 'function',
              name: 'get_weather',
              description: 'Get the current weather at a specific location',
              inputSchema: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
                additionalProperties: false,
              },
              strict: true,
              providerOptions: {
                openai: {
                  deferLoading: true,
                },
              },
            },
          ],
        });

        const toolSearchParts = (await convertReadableStreamToArray(stream))
          .filter(
            part =>
              (part.type === 'tool-input-start' &&
                part.toolName === 'toolSearch') ||
              (part.type === 'tool-input-end' && part.id === 'call_final') ||
              (part.type === 'tool-call' && part.toolName === 'toolSearch') ||
              (part.type === 'tool-result' && part.toolName === 'toolSearch'),
          )
          .map(part =>
            part.type === 'tool-call'
              ? { ...part, input: JSON.parse(part.input) }
              : part,
          );

        expect(toolSearchParts).toMatchInlineSnapshot(`
          [
            {
              "id": "call_final",
              "toolName": "toolSearch",
              "type": "tool-input-start",
            },
            {
              "id": "call_final",
              "type": "tool-input-end",
            },
            {
              "input": {
                "arguments": {
                  "goal": "Find the weather tool",
                },
                "call_id": "call_final",
              },
              "providerMetadata": {
                "openai": {
                  "itemId": "tsc_client_1",
                },
              },
              "toolCallId": "call_final",
              "toolName": "toolSearch",
              "type": "tool-call",
            },
            {
              "providerMetadata": {
                "openai": {
                  "itemId": "tso_client_1",
                },
              },
              "result": {
                "tools": [
                  {
                    "defer_loading": true,
                    "description": "Get the current weather at a specific location",
                    "name": "get_weather",
                    "parameters": {
                      "additionalProperties": false,
                      "properties": {
                        "location": {
                          "type": "string",
                        },
                      },
                      "required": [
                        "location",
                      ],
                      "type": "object",
                    },
                    "strict": true,
                    "type": "function",
                  },
                ],
              },
              "toolCallId": "call_final",
              "toolName": "toolSearch",
              "type": "tool-result",
            },
          ]
        `);
      });
    });

    describe('client tool search tool', () => {
      it('should stream client tool search call as non-provider-executed tool parts', async () => {
        prepareChunksFixtureResponse('openai-client-tool-search.1');

        const { stream } = await createModel('gpt-5.4').doStream({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
        });

        const allParts = await convertReadableStreamToArray(stream);

        const clientToolSearchParts = allParts
          .filter(
            (
              part,
            ): part is Extract<
              LanguageModelV4StreamPart,
              {
                type:
                  | 'tool-input-start'
                  | 'tool-input-end'
                  | 'tool-call'
                  | 'tool-result';
              }
            > =>
              (part.type === 'tool-input-start' &&
                part.toolName === 'toolSearch') ||
              part.type === 'tool-input-end' ||
              (part.type === 'tool-call' && part.toolName === 'toolSearch'),
          )
          .map(part =>
            part.type === 'tool-call'
              ? { ...part, input: JSON.parse(part.input) }
              : part,
          );

        expect(clientToolSearchParts).toMatchInlineSnapshot(`
          [
            {
              "id": "call_RWTIIVfxsJW9fecsg6fy23Dy",
              "toolName": "toolSearch",
              "type": "tool-input-start",
            },
            {
              "id": "call_RWTIIVfxsJW9fecsg6fy23Dy",
              "type": "tool-input-end",
            },
            {
              "input": {
                "arguments": {
                  "goal": "Find a tool that can provide current weather information for San Francisco.",
                },
                "call_id": "call_RWTIIVfxsJW9fecsg6fy23Dy",
              },
              "providerMetadata": {
                "openai": {
                  "itemId": "tsc_05147bbe356953b60069ab673598f88196b499a756b524b64c",
                },
              },
              "toolCallId": "call_RWTIIVfxsJW9fecsg6fy23Dy",
              "toolName": "toolSearch",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should not include providerExecuted flag for client tool search stream parts', async () => {
        prepareChunksFixtureResponse('openai-client-tool-search.1');

        const { stream } = await createModel('gpt-5.4').doStream({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
        });

        const allParts = await convertReadableStreamToArray(stream);

        const toolInputStart = allParts.find(
          (
            part,
          ): part is Extract<
            LanguageModelV4StreamPart,
            { type: 'tool-input-start' }
          > =>
            part.type === 'tool-input-start' && part.toolName === 'toolSearch',
        );
        const toolCall = allParts.find(
          (
            part,
          ): part is Extract<
            LanguageModelV4StreamPart,
            { type: 'tool-call' }
          > => part.type === 'tool-call' && part.toolName === 'toolSearch',
        );

        expect(toolInputStart?.providerExecuted).toBeUndefined();
        expect(toolCall?.providerExecuted).toBeUndefined();
      });

      it('should use final call_id from done chunk (not provisional from added chunk)', async () => {
        prepareChunksFixtureResponse('openai-client-tool-search.1');

        const { stream } = await createModel('gpt-5.4').doStream({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
        });

        const allParts = await convertReadableStreamToArray(stream);

        const toolCall = allParts.find(
          (
            part,
          ): part is Extract<
            LanguageModelV4StreamPart,
            { type: 'tool-call' }
          > => part.type === 'tool-call' && part.toolName === 'toolSearch',
        );

        const parsedInput = JSON.parse(toolCall!.input);

        expect(toolCall?.toolCallId).toBe('call_RWTIIVfxsJW9fecsg6fy23Dy');
        expect(parsedInput.call_id).toBe('call_RWTIIVfxsJW9fecsg6fy23Dy');
        expect(toolCall?.toolCallId).toBe(parsedInput.call_id);
      });

      it('should stream step 2 function call after client tool search output', async () => {
        prepareChunksFixtureResponse('openai-client-tool-search.2');

        const { stream } = await createModel('gpt-5.4').doStream({
          prompt: TEST_PROMPT,
          tools: CLIENT_TOOL_SEARCH_TOOLS,
        });

        const allParts = await convertReadableStreamToArray(stream);

        const functionCallPart = allParts.find(
          (
            part,
          ): part is Extract<
            LanguageModelV4StreamPart,
            { type: 'tool-call' }
          > => part.type === 'tool-call' && part.toolName === 'get_weather',
        );

        expect(functionCallPart).toBeDefined();
        expect(functionCallPart?.toolCallId).toBe(
          'call_Q7pq6EfVGRnauPLWSSYBGJ1l',
        );
        expect(JSON.parse(functionCallPart!.input)).toEqual({
          location: 'San Francisco, CA',
          unit: 'fahrenheit',
        });
      });
    });

    describe('file search tool', () => {
      it('should stream file search results without results include', async () => {
        prepareChunksFixtureResponse('openai-file-search-tool.1');

        const result = await createModel('gpt-5-nano').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.file_search',
              name: 'fileSearch',
              args: {
                vectorStoreIds: ['vs_68caad8bd5d88191ab766cf043d89a18'],
              },
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });

      it('should stream file search results with results include', async () => {
        prepareChunksFixtureResponse('openai-file-search-tool.2');

        const result = await createModel('gpt-5-nano').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.file_search',
              name: 'fileSearch',
              args: {
                vectorStoreIds: ['vs_68caad8bd5d88191ab766cf043d89a18'],
              },
            },
          ],
          providerOptions: {
            openai: {
              include: ['file_search_call.results'],
            },
          },
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('code interpreter tool', () => {
      it('should stream code interpreter results with annotations', async () => {
        prepareChunksFixtureResponse('openai-code-interpreter-tool.1');

        const streamResult = await createModel('gpt-5-nano').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.code_interpreter',
              name: 'codeExecution',
              args: {},
            },
          ],
        });

        const streamParts = await convertReadableStreamToArray(
          streamResult.stream,
        );

        expect(streamParts).toMatchSnapshot();

        const sourceParts = streamParts.filter(
          (
            part,
          ): part is Extract<LanguageModelV4StreamPart, { type: 'source' }> =>
            part.type === 'source',
        );

        expect(sourceParts).toHaveLength(1);
        expect(sourceParts).toEqual([
          expect.objectContaining({
            type: 'source',
            sourceType: 'document',
            filename: 'roll2dice_sums_10000.csv',
            mediaType: 'text/plain',
            providerMetadata: {
              openai: expect.objectContaining({
                fileId: 'cfile_68c2e7084ab48191a67824aa1f4c90f1',
                containerId:
                  'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
              }),
            },
          }),
        ]);
      });
    });

    describe('image generation tool', () => {
      it('should stream code image generation results', async () => {
        prepareChunksFixtureResponse('openai-image-generation-tool.1');

        const result = await createModel('gpt-5-nano').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.image_generation',
              name: 'generateImage',
              args: {},
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('local shell tool', () => {
      it('should stream code local shell results', async () => {
        prepareChunksFixtureResponse('openai-local-shell-tool.1');

        const result = await createModel('gpt-5-codex').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.local_shell',
              name: 'shell',
              args: {},
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('shell tool', () => {
      it('should stream shell tool results', async () => {
        prepareChunksFixtureResponse('openai-shell-tool.1');

        const result = await createModel('gpt-5.1').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {},
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('shell tool with container (no skills)', () => {
      it('should stream shell tool results with container execution', async () => {
        prepareChunksFixtureResponse('openai-shell-container.1');

        const result = await createModel('gpt-5.2').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('shell tool with container multiturn', () => {
      it('should stream follow-up response after shell tool history', async () => {
        prepareChunksFixtureResponse('openai-shell-container-multiturn.1');

        const multiturnPrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Run uname -a' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_abc123def456ghi789jkl012',
                toolName: 'shell',
                input: '{"action":{"commands":["uname -a"]}}',
                providerExecuted: true,
                providerOptions: {
                  openai: {
                    itemId:
                      'sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50',
                  },
                },
              },
              {
                type: 'tool-result',
                toolCallId: 'call_abc123def456ghi789jkl012',
                toolName: 'shell',
                output: {
                  type: 'json',
                  value: {
                    output: [
                      {
                        stdout:
                          'Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux\n',
                        stderr: '',
                        outcome: { type: 'exit', exitCode: 0 },
                      },
                    ],
                  },
                },
              },
              {
                type: 'text',
                text: 'Linux container-host 6.1.0 #1 SMP x86_64 GNU/Linux',
                providerOptions: {
                  openai: {
                    itemId:
                      'msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52',
                  },
                },
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What architecture do you run in?' },
            ],
          },
        ];

        const result = await createModel('gpt-5.2').doStream({
          prompt: multiturnPrompt,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('shell tool with local multiturn', () => {
      it('should stream follow-up response after local shell tool history', async () => {
        prepareChunksFixtureResponse('openai-shell-local-multiturn.1');

        const multiturnPrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Run uname -a' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_abc123def456ghi789jkl012',
                toolName: 'shell',
                input: '{"action":{"commands":["uname -a"]}}',
                providerOptions: {
                  openai: {
                    itemId:
                      'sh_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e50',
                  },
                },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_abc123def456ghi789jkl012',
                toolName: 'shell',
                output: {
                  type: 'json',
                  value: {
                    output: [
                      {
                        stdout:
                          'Darwin mac-host 24.6.0 Darwin Kernel Version 24.6.0 root:xnu-11417.60.45.601.5~1/RELEASE_ARM64_T6041 arm64\n',
                        stderr: '',
                        outcome: { type: 'exit', exitCode: 0 },
                      },
                    ],
                  },
                },
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Darwin mac-host 24.6.0 Darwin Kernel Version 24.6.0 arm64',
                providerOptions: {
                  openai: {
                    itemId:
                      'msg_0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e52',
                  },
                },
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What architecture do you run in?' },
            ],
          },
        ];

        const result = await createModel('gpt-5.2').doStream({
          prompt: multiturnPrompt,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {},
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('shell tool with environment', () => {
      it('should stream shell tool results with server-executed output', async () => {
        prepareChunksFixtureResponse('openai-shell-skills.1');

        const result = await createModel('gpt-5.2').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.shell',
              name: 'shell',
              args: {
                environment: {
                  type: 'containerAuto',
                },
              },
            },
          ],
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('mcp tool', () => {
      it('should stream mcp tool results (list tools, tool calls, tool results)', async () => {
        prepareChunksFixtureResponse('openai-mcp-tool.1');

        const { stream } = await createModel('gpt-5-mini').doStream({
          tools: [
            {
              type: 'provider',
              id: 'openai.mcp',
              name: 'MCP',
              args: {
                serverLabel: 'dmcp',
                serverUrl: 'https://mcp.exa.ai/mcp',
                serverDescription: 'A web-search API for AI agents',
              },
            },
          ],
          prompt: TEST_PROMPT,
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });
    });

    describe('mcp tool approval', () => {
      const MCP_TOOL = {
        type: 'provider' as const,
        id: 'openai.mcp' as const,
        name: 'MCP',
        args: {
          serverLabel: 'zip1',
          serverUrl: 'https://zip1.io/mcp',
          serverDescription: 'Link shortener',
          requireApproval: 'always' as const,
        },
      };

      it('should stream tool-call and tool-approval-request when model requests approval (turn 1)', async () => {
        prepareChunksFixtureResponse('openai-mcp-tool-approval.1');

        const { stream } = await createModel('gpt-5-mini').doStream({
          prompt: TEST_PROMPT,
          tools: [MCP_TOOL],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should stream text response after denial (turn 2)', async () => {
        prepareChunksFixtureResponse('openai-mcp-tool-approval.2');

        const { stream } = await createModel('gpt-5-mini').doStream({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04a97b4fce127879006949a83ac9308195a7f7b69ea82e91fe',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04a97b4fce127879006949a83ac9308195a7f7b69ea82e91fe',
                  approved: false,
                },
              ],
            },
          ],
          tools: [MCP_TOOL],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should stream new tool-approval-request when retrying (turn 3)', async () => {
        prepareChunksFixtureResponse('openai-mcp-tool-approval.3');

        const { stream } = await createModel('gpt-5-mini').doStream({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04a97b4fce127879006949a83ac9308195a7f7b69ea82e91fe',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04a97b4fce127879006949a83ac9308195a7f7b69ea82e91fe',
                  approved: false,
                },
              ],
            },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'The tool was not approved.' }],
            },
            { role: 'user', content: [{ type: 'text', text: 'try again' }] },
          ],
          tools: [MCP_TOOL],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should stream tool-call with result after approval (turn 4)', async () => {
        prepareChunksFixtureResponse('openai-mcp-tool-approval.4');

        const { stream } = await createModel('gpt-5-mini').doStream({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'shorten ai-sdk.dev' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId:
                    'mcpr_04a97b4fce127879006949a8672ac081959f95aa8ceedb7cd9',
                  toolName: 'mcp.create_short_url',
                  input: { url: 'https://ai-sdk.dev/' },
                  providerExecuted: true,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-approval-response',
                  approvalId:
                    'mcpr_04a97b4fce127879006949a8672ac081959f95aa8ceedb7cd9',
                  approved: true,
                },
              ],
            },
          ],
          tools: [MCP_TOOL],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });
    });

    describe('errors', () => {
      it('should throw an api error when the stream errors before output starts', async () => {
        prepareChunksFixtureResponse('openai-error.1');

        await expect(
          createModel('gpt-4o-mini').doStream({
            prompt: TEST_PROMPT,
            includeRawChunks: false,
          }),
        ).rejects.toMatchObject({
          message:
            'You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.',
          statusCode: 429,
          isRetryable: true,
        });
      });

      it('should throw an api error for documented top-level error events before output starts', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","sequence_number":0,"response":{"id":"resp_error_top_level","created_at":1741269019,"model":"gpt-4o-2024-07-18","service_tier":null}}\n\n`,
            `data:{"type":"error","sequence_number":1,"code":"rate_limit_exceeded","message":"Rate limit reached","param":null}\n\n`,
          ],
        };

        await expect(
          createModel('gpt-4o-mini').doStream({
            prompt: TEST_PROMPT,
            includeRawChunks: true,
          }),
        ).rejects.toMatchObject({
          message: 'Rate limit reached',
          statusCode: 429,
          isRetryable: true,
        });
      });

      it('should throw an api error when response.failed arrives before output starts', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","sequence_number":0,"response":{"id":"resp_failed_before_output","created_at":1741269019,"model":"gpt-4o-2024-07-18","service_tier":null}}\n\n`,
            `data:{"type":"response.failed","sequence_number":1,"response":{"error":{"code":"server_error","message":"response failed"},"incomplete_details":null,"usage":null,"service_tier":null}}\n\n`,
          ],
        };

        await expect(
          createModel('gpt-4o-mini').doStream({
            prompt: TEST_PROMPT,
            includeRawChunks: false,
          }),
        ).rejects.toMatchObject({
          message: 'response failed',
          statusCode: 500,
          isRetryable: true,
        });
      });

      it('should expose raw finish reason from late response.failed incomplete details', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","sequence_number":0,"response":{"id":"resp_failed_with_reason","created_at":1741269019,"model":"gpt-4o-2024-07-18","service_tier":null}}\n\n`,
            `data:{"type":"response.output_item.added","sequence_number":1,"output_index":0,"item":{"id":"msg_failed_with_reason","type":"message"}}\n\n`,
            `data:{"type":"error","sequence_number":2,"error":{"type":"server_error","code":"server_error","message":"response failed","param":null}}\n\n`,
            `data:{"type":"response.failed","sequence_number":3,"response":{"error":{"code":"server_error","message":"response failed"},"incomplete_details":{"reason":"max_output_tokens"},"usage":null,"service_tier":null}}\n\n`,
          ],
        };

        const { stream } = await createModel('gpt-4o-mini').doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        const events = await convertReadableStreamToArray(stream);

        expect(events).toMatchInlineSnapshot(`
          [
            {
              "type": "stream-start",
              "warnings": [],
            },
            {
              "id": "resp_failed_with_reason",
              "modelId": "gpt-4o-2024-07-18",
              "timestamp": 2025-03-06T13:50:19.000Z,
              "type": "response-metadata",
            },
            {
              "id": "msg_failed_with_reason",
              "providerMetadata": {
                "openai": {
                  "itemId": "msg_failed_with_reason",
                },
              },
              "type": "text-start",
            },
            {
              "error": {
                "error": {
                  "code": "server_error",
                  "message": "response failed",
                  "param": null,
                  "type": "server_error",
                },
                "sequence_number": 2,
                "type": "error",
              },
              "type": "error",
            },
            {
              "finishReason": {
                "raw": "max_output_tokens",
                "unified": "length",
              },
              "providerMetadata": {
                "openai": {
                  "responseId": "resp_failed_with_reason",
                },
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

    describe('reasoning', () => {
      it('should handle reasoning with summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":"**Exploring burrito origins**\\n\\nThe user is"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":" curious about the debate regarding Taqueria La Cumbre and El Farolito."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":"**Investigating burrito origins**\\n\\nThere's a fascinating debate"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":" about who created the Mission burrito."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":"answer"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":" text"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","summary":[{"type":"summary_text","text":"**Exploring burrito origins**\\n\\nThe user is curious about the debate regarding Taqueria La Cumbre and El Farolito."},{"type":"summary_text","text":"**Investigating burrito origins**\\n\\nThere's a fascinating debate about who created the Mission burrito."}]},{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"answer text","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":34,"input_tokens_details":{"cached_tokens":0},"output_tokens":538,"output_tokens_details":{"reasoning_tokens":320},"total_tokens":572},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('o3-mini').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: 'auto',
            },
          },
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                "modelId": "o3-mini-2025-01-31",
                "timestamp": 2025-03-06T13:50:19.000Z,
                "type": "response-metadata",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Exploring burrito origins**

            The user is",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " curious about the debate regarding Taqueria La Cumbre and El Farolito.",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Investigating burrito origins**

            There's a fascinating debate",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " about who created the Mission burrito.",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "answer",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "delta": " text",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-end",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 34,
                    "total": 34,
                  },
                  "outputTokens": {
                    "reasoning": 320,
                    "text": 218,
                    "total": 538,
                  },
                  "raw": {
                    "input_tokens": 34,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 538,
                    "output_tokens_details": {
                      "reasoning_tokens": 320,
                    },
                  },
                },
              },
            ]
          `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
            summary: 'auto',
          },
          stream: true,
        });
      });

      it('should handle reasoning with empty summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":"answer"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":" text"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","summary":[]},{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"answer text","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":34,"input_tokens_details":{"cached_tokens":0},"output_tokens":538,"output_tokens_details":{"reasoning_tokens":320},"total_tokens":572},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('o3-mini').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: null,
            },
          },
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                "modelId": "o3-mini-2025-01-31",
                "timestamp": 2025-03-06T13:50:19.000Z,
                "type": "response-metadata",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "answer",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "delta": " text",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-end",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 34,
                    "total": 34,
                  },
                  "outputTokens": {
                    "reasoning": 320,
                    "text": 218,
                    "total": 538,
                  },
                  "raw": {
                    "input_tokens": 34,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 538,
                    "output_tokens_details": {
                      "reasoning_tokens": 320,
                    },
                  },
                },
              },
            ]
          `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
          },
          stream: true,
        });
      });

      it('should handle encrypted content with summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_abc123"}}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":"**Exploring burrito origins**\\n\\nThe user is"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":" curious about the debate regarding Taqueria La Cumbre and El Farolito."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":"**Investigating burrito origins**\\n\\nThere's a fascinating debate"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":" about who created the Mission burrito."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_final_def456"}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":"answer"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":" text"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_final_def456","summary":[{"type":"summary_text","text":"**Exploring burrito origins**\\n\\nThe user is curious about the debate regarding Taqueria La Cumbre and El Farolito."},{"type":"summary_text","text":"**Investigating burrito origins**\\n\\nThere's a fascinating debate about who created the Mission burrito."}]},{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"answer text","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":34,"input_tokens_details":{"cached_tokens":0},"output_tokens":538,"output_tokens_details":{"reasoning_tokens":320},"total_tokens":572},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('o3-mini').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: 'auto',
              include: ['reasoning.encrypted_content'],
            },
          },
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                "modelId": "o3-mini-2025-01-31",
                "timestamp": 2025-03-06T13:50:19.000Z,
                "type": "response-metadata",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Exploring burrito origins**

            The user is",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " curious about the debate regarding Taqueria La Cumbre and El Farolito.",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Investigating burrito origins**

            There's a fascinating debate",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " about who created the Mission burrito.",
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": "encrypted_reasoning_data_final_def456",
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "answer",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "delta": " text",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-end",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 34,
                    "total": 34,
                  },
                  "outputTokens": {
                    "reasoning": 320,
                    "text": 218,
                    "total": 538,
                  },
                  "raw": {
                    "input_tokens": 34,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 538,
                    "output_tokens_details": {
                      "reasoning_tokens": 320,
                    },
                  },
                },
              },
            ]
          `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
            summary: 'auto',
          },
          include: ['reasoning.encrypted_content'],
          stream: true,
        });
      });

      it('should stream with encrypted content include reasoning-delta part', async () => {
        prepareChunksFixtureResponse('openai-reasoning-encrypted-content.1');
        const { stream } = await createModel('gpt-5.1-codex-max').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'calculator',
              inputSchema: {
                type: 'object',
                properties: {
                  a: { type: 'number' },
                  b: { type: 'number' },
                  op: { type: 'string' },
                },
                required: ['a', 'b'],
                additionalProperties: false,
              },
            },
          ],
          providerOptions: {
            openai: {
              reasoningEffort: 'high',
              maxCompletionTokens: 32_000,
              store: false,
              include: ['reasoning.encrypted_content'],
              reasoningSummary: 'auto',
              forceReasoning: true,
            },
          },
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should handle encrypted content with empty summary', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_abc123"}}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_final_def456"}}\n\n`,
            `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":"answer"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":" text"}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","encrypted_content":"encrypted_reasoning_data_final_def456","summary":[]},{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"answer text","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"low","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":34,"input_tokens_details":{"cached_tokens":0},"output_tokens":538,"output_tokens_details":{"reasoning_tokens":320},"total_tokens":572},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('o3-mini').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              reasoningSummary: null,
              include: ['reasoning.encrypted_content'],
            },
          },
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                "modelId": "o3-mini-2025-01-31",
                "timestamp": 2025-03-06T13:50:19.000Z,
                "type": "response-metadata",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": "encrypted_reasoning_data_abc123",
                  },
                },
                "type": "reasoning-start",
              },
              {
                "id": "rs_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": "encrypted_reasoning_data_final_def456",
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "answer",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "delta": " text",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-end",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 34,
                    "total": 34,
                  },
                  "outputTokens": {
                    "reasoning": 320,
                    "text": 218,
                    "total": 538,
                  },
                  "raw": {
                    "input_tokens": 34,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 538,
                    "output_tokens_details": {
                      "reasoning_tokens": 320,
                    },
                  },
                },
              },
            ]
          `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'low',
          },
          include: ['reasoning.encrypted_content'],
          stream: true,
        });
      });

      it('should handle multiple reasoning blocks', async () => {
        server.urls['https://api.openai.com/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [
            `data:{"type":"response.created","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"in_progress","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}\n\n`,
            // First reasoning block (with multiple summary parts)
            `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":"**Initial analysis**\\n\\nFirst reasoning block:"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0,"delta":" analyzing the problem structure."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":"**Deeper consideration**\\n\\nLet me think about"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1,"delta":" the various approaches available."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","summary_index":1}\n\n`,
            `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning"}}\n\n`,
            // First message
            `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":"Let me think about"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_67c97c02656c81908e080dfdf4a03cd1","delta":" this step by step."}\n\n`,
            `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message"}}\n\n`,
            // Second reasoning block
            `data:{"type":"response.output_item.added","output_index":2,"item":{"id":"rs_second_7908809g7gcc9291be3e3fee895028c4","type":"reasoning"}}\n\n`,
            `data:{"type":"response.reasoning_summary_part.added","item_id":"rs_second_7908809g7gcc9291be3e3fee895028c4","summary_index":0}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_second_7908809g7gcc9291be3e3fee895028c4","summary_index":0,"delta":"Second reasoning block:"}\n\n`,
            `data:{"type":"response.reasoning_summary_text.delta","item_id":"rs_second_7908809g7gcc9291be3e3fee895028c4","summary_index":0,"delta":" considering alternative approaches."}\n\n`,
            `data:{"type":"response.reasoning_summary_part.done","item_id":"rs_second_7908809g7gcc9291be3e3fee895028c4","summary_index":0}\n\n`,
            `data:{"type":"response.output_item.done","output_index":2,"item":{"id":"rs_second_7908809g7gcc9291be3e3fee895028c4","type":"reasoning"}}\n\n`,
            // Final message
            `data:{"type":"response.output_item.added","output_index":3,"item":{"id":"msg_final_78d08d03767d92908f25523f5ge51e77","type":"message"}}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_final_78d08d03767d92908f25523f5ge51e77","delta":"Based on my analysis,"}\n\n`,
            `data:{"type":"response.output_text.delta","item_id":"msg_final_78d08d03767d92908f25523f5ge51e77","delta":" here is the solution."}\n\n`,
            `data:{"type":"response.output_item.done","output_index":3,"item":{"id":"msg_final_78d08d03767d92908f25523f5ge51e77","type":"message"}}\n\n`,
            `data:{"type":"response.completed","response":{"id":"resp_67c9a81b6a048190a9ee441c5755a4e8","object":"response","created_at":1741269019,"status":"completed","error":null,"incomplete_details":null,"input":[],"instructions":null,"max_output_tokens":null,"model":"o3-mini-2025-01-31","output":[{"id":"rs_first_6808709f6fcc8191ad2e2fdd784017b3","type":"reasoning","summary":[{"type":"summary_text","text":"**Initial analysis**\\n\\nFirst reasoning block: analyzing the problem structure."},{"type":"summary_text","text":"**Deeper consideration**\\n\\nLet me think about the various approaches available."}]},{"id":"msg_67c97c02656c81908e080dfdf4a03cd1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Let me think about this step by step.","annotations":[]}]},{"id":"rs_second_7908809g7gcc9291be3e3fee895028c4","type":"reasoning","summary":[{"type":"summary_text","text":"Second reasoning block: considering alternative approaches."}]},{"id":"msg_final_78d08d03767d92908f25523f5ge51e77","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Based on my analysis, here is the solution.","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":"medium","summary":"auto"},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":null,"truncation":"disabled","usage":{"input_tokens":45,"input_tokens_details":{"cached_tokens":0},"output_tokens":628,"output_tokens_details":{"reasoning_tokens":420},"total_tokens":673},"user":null,"metadata":{}}}\n\n`,
          ],
        };

        const { stream } = await createModel('o3-mini').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              reasoningEffort: 'medium',
              reasoningSummary: 'auto',
            },
          },
          includeRawChunks: false,
        });

        expect(await convertReadableStreamToArray(stream))
          .toMatchInlineSnapshot(`
            [
              {
                "type": "stream-start",
                "warnings": [],
              },
              {
                "id": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                "modelId": "o3-mini-2025-01-31",
                "timestamp": 2025-03-06T13:50:19.000Z,
                "type": "response-metadata",
              },
              {
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Initial analysis**

            First reasoning block:",
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " analyzing the problem structure.",
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "**Deeper consideration**

            Let me think about",
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " the various approaches available.",
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_first_6808709f6fcc8191ad2e2fdd784017b3:1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_first_6808709f6fcc8191ad2e2fdd784017b3",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "Let me think about",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "delta": " this step by step.",
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "type": "text-delta",
              },
              {
                "id": "msg_67c97c02656c81908e080dfdf4a03cd1",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                  },
                },
                "type": "text-end",
              },
              {
                "id": "rs_second_7908809g7gcc9291be3e3fee895028c4:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_second_7908809g7gcc9291be3e3fee895028c4",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-start",
              },
              {
                "delta": "Second reasoning block:",
                "id": "rs_second_7908809g7gcc9291be3e3fee895028c4:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_second_7908809g7gcc9291be3e3fee895028c4",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "delta": " considering alternative approaches.",
                "id": "rs_second_7908809g7gcc9291be3e3fee895028c4:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_second_7908809g7gcc9291be3e3fee895028c4",
                  },
                },
                "type": "reasoning-delta",
              },
              {
                "id": "rs_second_7908809g7gcc9291be3e3fee895028c4:0",
                "providerMetadata": {
                  "openai": {
                    "itemId": "rs_second_7908809g7gcc9291be3e3fee895028c4",
                    "reasoningEncryptedContent": null,
                  },
                },
                "type": "reasoning-end",
              },
              {
                "id": "msg_final_78d08d03767d92908f25523f5ge51e77",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_final_78d08d03767d92908f25523f5ge51e77",
                  },
                },
                "type": "text-start",
              },
              {
                "delta": "Based on my analysis,",
                "id": "msg_final_78d08d03767d92908f25523f5ge51e77",
                "type": "text-delta",
              },
              {
                "delta": " here is the solution.",
                "id": "msg_final_78d08d03767d92908f25523f5ge51e77",
                "type": "text-delta",
              },
              {
                "id": "msg_final_78d08d03767d92908f25523f5ge51e77",
                "providerMetadata": {
                  "openai": {
                    "itemId": "msg_final_78d08d03767d92908f25523f5ge51e77",
                  },
                },
                "type": "text-end",
              },
              {
                "finishReason": {
                  "raw": undefined,
                  "unified": "stop",
                },
                "providerMetadata": {
                  "openai": {
                    "responseId": "resp_67c9a81b6a048190a9ee441c5755a4e8",
                  },
                },
                "type": "finish",
                "usage": {
                  "inputTokens": {
                    "cacheRead": 0,
                    "cacheWrite": undefined,
                    "noCache": 45,
                    "total": 45,
                  },
                  "outputTokens": {
                    "reasoning": 420,
                    "text": 208,
                    "total": 628,
                  },
                  "raw": {
                    "input_tokens": 45,
                    "input_tokens_details": {
                      "cached_tokens": 0,
                    },
                    "output_tokens": 628,
                    "output_tokens_details": {
                      "reasoning_tokens": 420,
                    },
                  },
                },
              },
            ]
          `);

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'o3-mini',
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          stream: true,
        });
      });
    });

    describe('apply_patch tool streaming', () => {
      it('should handle apply_patch tool calls in streaming mode', async () => {
        prepareChunksFixtureResponse('openai-apply-patch-tool.1');

        const { stream } = await createModel('gpt-5.1-2025-11-13').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.apply_patch',
              name: 'apply_patch',
              args: {},
            },
          ],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });

      it('should stream apply_patch delete_file calls', async () => {
        prepareChunksFixtureResponse('openai-apply-patch-tool-delete.1');

        const { stream } = await createModel('gpt-5.1-2025-11-13').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'openai.apply_patch',
              name: 'apply_patch',
              args: {},
            },
          ],
        });

        expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
      });
    });
  });

  describe('mixed citation types', () => {
    it('should handle both url_citation and file_citation annotations', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.content_part.added","item_id":"msg_123","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}\n\n`,
          `data:{"type":"response.output_text.annotation.added","item_id":"msg_123","output_index":0,"content_index":0,"annotation_index":0,"annotation":{"type":"url_citation","url":"https://example.com","title":"Example URL","start_index":123,"end_index":234}}\n\n`,
          `data:{"type":"response.output_text.annotation.added","item_id":"msg_123","output_index":0,"content_index":0,"annotation_index":1,"annotation":{"type":"file_citation","index":123,"file_id":"file-abc123","filename":"resource1.json"}}\n\n`,
          `data:{"type":"response.content_part.done","item_id":"msg_123","output_index":0,"content_index":0,"part":{"type":"output_text","text":"Based on web search and file content.","annotations":[{"type":"url_citation","start_index":0,"end_index":10,"url":"https://example.com","title":"Example URL"},{"type":"file_citation","index":123,"file_id":"file-abc123","filename":"resource1.json"}]}}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_123","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Based on web search and file content.","annotations":[{"type":"url_citation","start_index":0,"end_index":10,"url":"https://example.com","title":"Example URL"},{"type":"file_citation","index":123,"file_id":"file-abc123","filename":"resource1.json"}]}]}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_123","object":"response","created_at":1234567890,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-4o","output":[{"id":"msg_123","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Based on web search and file content.","annotations":[{"type":"url_citation","start_index":0,"end_index":10,"url":"https://example.com","title":"Example URL"},{"type":"file_citation","index":123,"file_id":"file-abc123","filename":"resource1.json"}]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":0},"output_tokens":50,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":150},"user":null,"metadata":{}}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const result = await convertReadableStreamToArray(stream);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "id-0",
            "sourceType": "url",
            "title": "Example URL",
            "type": "source",
            "url": "https://example.com",
          },
          {
            "filename": "resource1.json",
            "id": "id-1",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-abc123",
                "index": 123,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
          {
            "id": "msg_123",
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "end_index": 234,
                    "start_index": 123,
                    "title": "Example URL",
                    "type": "url_citation",
                    "url": "https://example.com",
                  },
                  {
                    "file_id": "file-abc123",
                    "filename": "resource1.json",
                    "index": 123,
                    "type": "file_citation",
                  },
                ],
                "itemId": "msg_123",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": null,
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 100,
                "total": 100,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 50,
                "total": 50,
              },
              "raw": {
                "input_tokens": 100,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 50,
                "output_tokens_details": {
                  "reasoning_tokens": 0,
                },
              },
            },
          },
        ]
      `);
    });

    it('should handle file_citation annotations without optional fields in streaming', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.content_part.added","item_id":"msg_456","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}\n\n`,
          `data:{"type":"response.output_text.annotation.added","item_id":"msg_456","output_index":0,"content_index":0,"annotation_index":0,"annotation":{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":145}}\n\n`,
          `data:{"type":"response.output_text.annotation.added","item_id":"msg_456","output_index":0,"content_index":0,"annotation_index":1,"annotation":{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":192}}\n\n`,
          `data:{"type":"response.content_part.done","item_id":"msg_456","output_index":0,"content_index":0,"part":{"type":"output_text","text":"Answer for the specified years....","annotations":[{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":145},{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":192}]}}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_456","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Answer for the specified years....","annotations":[{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":145},{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":192}]}]}}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_456","object":"response","created_at":1234567890,"status":"completed","error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":null,"model":"gpt-5","output":[{"id":"msg_456","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Answer for the specified years....","annotations":[{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":145},{"type":"file_citation","file_id":"file-YRcoCqn3Fo2K4JgraG","filename":"resource1.json","index":192}]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1,"truncation":"disabled","usage":{"input_tokens":50,"input_tokens_details":{"cached_tokens":0},"output_tokens":25,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":75},"user":null,"metadata":{}}}\n\n`,
          'data: [DONE]\n\n',
        ],
      };
      const { stream } = await createModel('gpt-5').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      const result = await convertReadableStreamToArray(stream);
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "filename": "resource1.json",
            "id": "id-0",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-YRcoCqn3Fo2K4JgraG",
                "index": 145,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
          {
            "filename": "resource1.json",
            "id": "id-1",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "fileId": "file-YRcoCqn3Fo2K4JgraG",
                "index": 192,
                "type": "file_citation",
              },
            },
            "sourceType": "document",
            "title": "resource1.json",
            "type": "source",
          },
          {
            "id": "msg_456",
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "file_id": "file-YRcoCqn3Fo2K4JgraG",
                    "filename": "resource1.json",
                    "index": 145,
                    "type": "file_citation",
                  },
                  {
                    "file_id": "file-YRcoCqn3Fo2K4JgraG",
                    "filename": "resource1.json",
                    "index": 192,
                    "type": "file_citation",
                  },
                ],
                "itemId": "msg_456",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": null,
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 50,
                "total": 50,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 25,
                "total": 25,
              },
              "raw": {
                "input_tokens": 50,
                "input_tokens_details": {
                  "cached_tokens": 0,
                },
                "output_tokens": 25,
                "output_tokens_details": {
                  "reasoning_tokens": 0,
                },
              },
            },
          },
        ]
      `);
    });
    it('should handle container_file_citation annotations in streaming', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:${JSON.stringify({ type: 'response.content_part.added', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.output_text.annotation.added', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, annotation_index: 0, annotation: { type: 'container_file_citation', container_id: 'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9', end_index: 465, file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1', filename: 'roll2dice_sums_10000.csv', start_index: 423 } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.content_part.done', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, part: { type: 'output_text', annotations: [{ type: 'container_file_citation', container_id: 'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9', end_index: 465, file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1', filename: 'roll2dice_sums_10000.csv', start_index: 423 }], logprobs: [], text: "Heres a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.)." } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.output_item.done', output_index: 0, item: { id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', type: 'message', status: 'completed', content: [{ type: 'output_text', annotations: [{ type: 'container_file_citation', container_id: 'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9', end_index: 465, file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1', filename: 'roll2dice_sums_10000.csv', start_index: 423 }], logprobs: [], text: "Heres a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.)." }], role: 'assistant' } })}\n\n`,
          `data:${JSON.stringify({
            type: 'response.completed',
            response: {
              id: 'resp_68c2e6efa238819383d5f52a2c2a3baa02d3a5742c7ddae9',
              object: 'response',
              created_at: 1757603567,
              status: 'completed',
              error: null,
              incomplete_details: null,
              instructions: null,
              max_output_tokens: null,
              model: 'gpt-5-nano-2025-08-07',
              output: [
                {
                  id: 'rs_68c2e6f40ba48193a1c27abf31130e7e02d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e6f7b72c8193ba1f552552c8dc9202d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: 'import random, math\nN=10000\nsums=[]\ns=0\nfor _ in range(N):\n    a=random.randint(1,6)\n    b=random.randint(1,6)\n    sm=a+b\n    sums.append(sm)\n    s+=sm\nmin(sums), max(sums), sum(sums), sum(sums)/N\n',
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [{ type: 'logs', logs: '(2, 12, 69868, 6.9868)' }],
                },
                {
                  id: 'rs_68c2e6fcb52881938f21c45741216ac002d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e6fd57948193aa93df6bdb00a86d02d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: "import csv, pathlib\npath = pathlib.Path('/mnt/data/roll2dice_sums_10000.csv')\nwith open(path, 'w', newline='') as f:\n    writer = csv.writer(f)\n    writer.writerow(['sum'])\n    for val in sums:\n        writer.writerow([val])\npath, path.exists(), len(sums)\n",
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [
                    {
                      type: 'logs',
                      logs: "(PosixPath('/mnt/data/roll2dice_sums_10000.csv'), True, 10000)",
                    },
                  ],
                },
                {
                  id: 'rs_68c2e6fff1808193a78d43410a1feb4802d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e701a23081939c93b6fb5bb952d302d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: 'sums[:20]\n',
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [
                    {
                      type: 'logs',
                      logs: '[6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7]',
                    },
                  ],
                },
                {
                  id: 'rs_68c2e703d114819383c5da260649c7ce02d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9',
                  type: 'message',
                  status: 'completed',
                  content: [
                    {
                      type: 'output_text',
                      annotations: [
                        {
                          type: 'container_file_citation',
                          container_id:
                            'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                          end_index: 465,
                          file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1',
                          filename: 'roll2dice_sums_10000.csv',
                          start_index: 423,
                        },
                      ],
                      logprobs: [],
                      text: "Here's a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.).",
                    },
                  ],
                  role: 'assistant',
                },
              ],
              parallel_tool_calls: true,
              previous_response_id: null,
              prompt_cache_key: null,
              reasoning: { effort: 'medium', summary: null },
              safety_identifier: null,
              store: true,
              temperature: 1,
              text: { format: { type: 'text' }, verbosity: 'medium' },
              tool_choice: 'auto',
              tools: [
                { type: 'code_interpreter', container: { type: 'auto' } },
              ],
              top_logprobs: 0,
              top_p: 1,
              truncation: 'disabled',
              usage: {
                input_tokens: 6047,
                input_tokens_details: { cached_tokens: 2944 },
                output_tokens: 1623,
                output_tokens_details: { reasoning_tokens: 1408 },
                total_tokens: 7670,
              },
              user: null,
              metadata: {},
            },
          })}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await createModel('gpt-5').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const result = await convertReadableStreamToArray(stream);
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "filename": "roll2dice_sums_10000.csv",
            "id": "id-0",
            "mediaType": "text/plain",
            "providerMetadata": {
              "openai": {
                "containerId": "cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9",
                "fileId": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
                "type": "container_file_citation",
              },
            },
            "sourceType": "document",
            "title": "roll2dice_sums_10000.csv",
            "type": "source",
          },
          {
            "id": "msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9",
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "container_id": "cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9",
                    "end_index": 465,
                    "file_id": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
                    "filename": "roll2dice_sums_10000.csv",
                    "start_index": 423,
                    "type": "container_file_citation",
                  },
                ],
                "itemId": "msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": null,
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 2944,
                "cacheWrite": undefined,
                "noCache": 3103,
                "total": 6047,
              },
              "outputTokens": {
                "reasoning": 1408,
                "text": 215,
                "total": 1623,
              },
              "raw": {
                "input_tokens": 6047,
                "input_tokens_details": {
                  "cached_tokens": 2944,
                },
                "output_tokens": 1623,
                "output_tokens_details": {
                  "reasoning_tokens": 1408,
                },
              },
            },
          },
        ]
      `);
    });

    it('should handle file_path annotations in streaming', async () => {
      server.urls['https://api.openai.com/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:${JSON.stringify({ type: 'response.content_part.added', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.output_text.annotation.added', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, annotation_index: 0, annotation: { type: 'file_path', file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1', index: 123 } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.content_part.done', item_id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', output_index: 0, content_index: 0, part: { type: 'output_text', annotations: [{ type: 'file_path', file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1', index: 123 }], logprobs: [], text: "Heres a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.)." } })}\n\n`,
          `data:${JSON.stringify({ type: 'response.output_item.done', output_index: 0, item: { id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9', type: 'message', status: 'completed', content: [{ type: 'output_text', annotations: [{ type: 'file_path', file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1' }], logprobs: [], text: "Heres a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.)." }], role: 'assistant' } })}\n\n`,
          `data:${JSON.stringify({
            type: 'response.completed',
            response: {
              id: 'resp_68c2e6efa238819383d5f52a2c2a3baa02d3a5742c7ddae9',
              object: 'response',
              created_at: 1757603567,
              status: 'completed',
              error: null,
              incomplete_details: null,
              instructions: null,
              max_output_tokens: null,
              model: 'gpt-5-nano-2025-08-07',
              output: [
                {
                  id: 'rs_68c2e6f40ba48193a1c27abf31130e7e02d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e6f7b72c8193ba1f552552c8dc9202d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: 'import random, math\nN=10000\nsums=[]\ns=0\nfor _ in range(N):\n    a=random.randint(1,6)\n    b=random.randint(1,6)\n    sm=a+b\n    sums.append(sm)\n    s+=sm\nmin(sums), max(sums), sum(sums), sum(sums)/N\n',
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [{ type: 'logs', logs: '(2, 12, 69868, 6.9868)' }],
                },
                {
                  id: 'rs_68c2e6fcb52881938f21c45741216ac002d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e6fd57948193aa93df6bdb00a86d02d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: "import csv, pathlib\npath = pathlib.Path('/mnt/data/roll2dice_sums_10000.csv')\nwith open(path, 'w', newline='') as f:\n    writer = csv.writer(f)\n    writer.writerow(['sum'])\n    for val in sums:\n        writer.writerow([val])\npath, path.exists(), len(sums)\n",
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [
                    {
                      type: 'logs',
                      logs: "(PosixPath('/mnt/data/roll2dice_sums_10000.csv'), True, 10000)",
                    },
                  ],
                },
                {
                  id: 'rs_68c2e6fff1808193a78d43410a1feb4802d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'ci_68c2e701a23081939c93b6fb5bb952d302d3a5742c7ddae9',
                  type: 'code_interpreter_call',
                  status: 'completed',
                  code: 'sums[:20]\n',
                  container_id:
                    'cntr_68c2e6f380d881908a57a82d394434ff02f484f5344062e9',
                  outputs: [
                    {
                      type: 'logs',
                      logs: '[6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7]',
                    },
                  ],
                },
                {
                  id: 'rs_68c2e703d114819383c5da260649c7ce02d3a5742c7ddae9',
                  type: 'reasoning',
                  summary: [],
                },
                {
                  id: 'msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9',
                  type: 'message',
                  status: 'completed',
                  content: [
                    {
                      type: 'output_text',
                      annotations: [
                        {
                          type: 'file_path',
                          file_id: 'cfile_68c2e7084ab48191a67824aa1f4c90f1',
                          index: 123,
                        },
                      ],
                      logprobs: [],
                      text: "Here's a simulation of rolling two fair six-sided dice 10,000 times. Each trial sums the two dice.\n\nResults\n- Total sum of all 10,000 trials: 69,868\n- Average sum per trial: 6.9868\n- Minimum sum observed: 2\n- Maximum sum observed: 12\n- Sample of the first 20 trial sums: 6, 7, 2, 5, 5, 11, 4, 8, 10, 7, 5, 8, 8, 7, 10, 8, 9, 5, 4, 7\n\nFull data\n- You can download all 10,000 sums as a CSV file here: [Download the sums CSV](sandbox:/mnt/data/roll2dice_sums_10000.csv)\n\nIf you'd like, I can also provide a frequency distribution, histogram, or export the data in another format (JSON, Excel, etc.).",
                    },
                  ],
                  role: 'assistant',
                },
              ],
              parallel_tool_calls: true,
              previous_response_id: null,
              prompt_cache_key: null,
              reasoning: { effort: 'medium', summary: null },
              safety_identifier: null,
              store: true,
              temperature: 1,
              text: { format: { type: 'text' }, verbosity: 'medium' },
              tool_choice: 'auto',
              tools: [
                { type: 'code_interpreter', container: { type: 'auto' } },
              ],
              top_logprobs: 0,
              top_p: 1,
              truncation: 'disabled',
              usage: {
                input_tokens: 6047,
                input_tokens_details: { cached_tokens: 2944 },
                output_tokens: 1623,
                output_tokens_details: { reasoning_tokens: 1408 },
                total_tokens: 7670,
              },
              user: null,
              metadata: {},
            },
          })}\n\n`,
          'data: [DONE]\n\n',
        ],
      };

      const { stream } = await createModel('gpt-4o').doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const result = await convertReadableStreamToArray(stream);
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "filename": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
            "id": "id-0",
            "mediaType": "application/octet-stream",
            "providerMetadata": {
              "openai": {
                "fileId": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
                "index": 123,
                "type": "file_path",
              },
            },
            "sourceType": "document",
            "title": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
            "type": "source",
          },
          {
            "id": "msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9",
            "providerMetadata": {
              "openai": {
                "annotations": [
                  {
                    "file_id": "cfile_68c2e7084ab48191a67824aa1f4c90f1",
                    "index": 123,
                    "type": "file_path",
                  },
                ],
                "itemId": "msg_68c2e7054ae481938354ab3e4e77abad02d3a5742c7ddae9",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "openai": {
                "responseId": null,
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 2944,
                "cacheWrite": undefined,
                "noCache": 3103,
                "total": 6047,
              },
              "outputTokens": {
                "reasoning": 1408,
                "text": 215,
                "total": 1623,
              },
              "raw": {
                "input_tokens": 6047,
                "input_tokens_details": {
                  "cached_tokens": 2944,
                },
                "output_tokens": 1623,
                "output_tokens_details": {
                  "reasoning_tokens": 1408,
                },
              },
            },
          },
        ]
      `);
    });

    describe('compaction', () => {
      it('should stream compaction output item from real fixture', async () => {
        prepareChunksFixtureResponse('openai-compaction.1');

        const result = await createModel('gpt-5.2').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });

      it('should send context_management in streaming request body', async () => {
        prepareChunksFixtureResponse('openai-compaction.1');

        await createModel('gpt-5.2').doStream({
          prompt: TEST_PROMPT,
          providerOptions: {
            openai: {
              store: false,
              contextManagement: [
                { type: 'compaction', compactThreshold: 50000 },
              ],
            },
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          model: 'gpt-5.2',
          store: false,
          stream: true,
          context_management: [
            { type: 'compaction', compact_threshold: 50000 },
          ],
        });
      });
    });

    describe('phase', () => {
      it('should include phase in provider metadata for streamed message items', async () => {
        prepareChunksFixtureResponse('openai-phase.1');

        const { stream } = await createModel('gpt-5.3-codex').doStream({
          prompt: TEST_PROMPT,
          includeRawChunks: false,
        });

        const parts = await convertReadableStreamToArray(stream);

        const textStartParts = parts.filter(
          (
            part,
          ): part is Extract<
            LanguageModelV4StreamPart,
            { type: 'text-start' }
          > => part.type === 'text-start',
        );

        expect(textStartParts).toHaveLength(2);
        expect(textStartParts[0].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0a63f40a2632b74300699f8819a5e08196ac270722d369af5a',
          phase: 'commentary',
        });
        expect(textStartParts[1].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0a63f40a2632b74300699f881bfbc88196aec38f30c3dd24b0',
          phase: 'final_answer',
        });

        const textEndParts = parts.filter(
          (
            part,
          ): part is Extract<LanguageModelV4StreamPart, { type: 'text-end' }> =>
            part.type === 'text-end',
        );

        expect(textEndParts).toHaveLength(2);
        expect(textEndParts[0].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0a63f40a2632b74300699f8819a5e08196ac270722d369af5a',
          phase: 'commentary',
        });
        expect(textEndParts[1].providerMetadata?.openai).toMatchObject({
          itemId: 'msg_0a63f40a2632b74300699f881bfbc88196aec38f30c3dd24b0',
          phase: 'final_answer',
        });
      });
    });
  });
});
