import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { XaiResponsesLanguageModel } from './xai-responses-language-model';
import type { XaiLanguageModelResponsesOptions } from './xai-responses-language-model-options';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'hello' }] },
];

function createModel(modelId = 'grok-4-fast-non-reasoning') {
  return new XaiResponsesLanguageModel(modelId, {
    provider: 'xai.responses',
    baseURL: 'https://api.x.ai/v1',
    headers: () => ({ Authorization: 'Bearer test-key' }),
    generateId: mockId(),
  });
}

describe('XaiResponsesLanguageModel', () => {
  const server = createTestServer({
    'https://api.x.ai/v1/responses': {},
  });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls['https://api.x.ai/v1/responses'].response = {
      type: 'json-value',
      body: JSON.parse(
        fs.readFileSync(`src/responses/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
  }

  function prepareChunksFixtureResponse(filename: string) {
    const chunks = fs
      .readFileSync(`src/responses/__fixtures__/${filename}.chunks.txt`, 'utf8')
      .split('\n')
      .map(line => `data: ${line}\n\n`);
    chunks.push('data: [DONE]\n\n');

    server.urls['https://api.x.ai/v1/responses'].response = {
      type: 'stream-chunks',
      chunks,
    };
  }

  function prepareJsonResponse(body: Record<string, unknown>) {
    server.urls['https://api.x.ai/v1/responses'].response = {
      type: 'json-value',
      body,
    };
  }

  function prepareStreamChunks(chunks: string[]) {
    server.urls['https://api.x.ai/v1/responses'].response = {
      type: 'stream-chunks',
      chunks: chunks
        .map(chunk => `data: ${chunk}\n\n`)
        .concat('data: [DONE]\n\n'),
    };
  }

  describe('doGenerate', () => {
    describe('basic text generation', () => {
      it('should generate text content', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          created_at: 1700000000,
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'hello world',
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
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "text": "hello world",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract usage correctly', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: {
            input_tokens: 345,
            output_tokens: 538,
            total_tokens: 883,
            output_tokens_details: {
              reasoning_tokens: 123,
            },
          },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 345,
              "total": 345,
            },
            "outputTokens": {
              "reasoning": 123,
              "text": 415,
              "total": 538,
            },
            "raw": {
              "input_tokens": 345,
              "output_tokens": 538,
              "output_tokens_details": {
                "reasoning_tokens": 123,
              },
              "total_tokens": 883,
            },
          }
        `);
      });

      it('should expose cost_in_usd_ticks in providerMetadata', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cost_in_usd_ticks: 113500,
          },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.providerMetadata).toStrictEqual({
          xai: { costInUsdTicks: 113500 },
        });
      });

      it('should not include providerMetadata when cost_in_usd_ticks is missing', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.providerMetadata).toBeUndefined();
      });

      it('should extract finish reason from status', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": "completed",
            "unified": "stop",
          }
        `);
      });

      it('should return tool-calls finish reason when function_call is present', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'function_call',
              id: 'fc_123',
              name: 'weather',
              arguments: '{"location":"sf"}',
              call_id: 'call_123',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'get weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
            },
          ],
        });

        expect(result.finishReason).toMatchInlineSnapshot(`
          {
            "raw": "completed",
            "unified": "tool-calls",
          }
        `);
      });
    });

    describe('reasoning content', () => {
      it('should extract reasoning with encrypted content when store=false', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [
                {
                  type: 'summary_text',
                  text: 'First, analyze the question carefully.',
                },
              ],
              encrypted_content: 'abc123encryptedcontent',
            },
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'The answer is 42.',
                  annotations: [],
                },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            output_tokens_details: {
              reasoning_tokens: 15,
            },
          },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "xai": {
                  "itemId": "rs_456",
                  "reasoningEncryptedContent": "abc123encryptedcontent",
                },
              },
              "text": "First, analyze the question carefully.",
              "type": "reasoning",
            },
            {
              "text": "The answer is 42.",
              "type": "text",
            },
          ]
        `);
      });

      it('should handle reasoning without encrypted content', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [
                {
                  type: 'summary_text',
                  text: 'Thinking through the problem.',
                },
              ],
            },
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Solution found.',
                  annotations: [],
                },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 15,
          },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "xai": {
                  "itemId": "rs_456",
                },
              },
              "text": "Thinking through the problem.",
              "type": "reasoning",
            },
            {
              "text": "Solution found.",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract reasoning from content when summary is empty', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-3-mini',
          output: [
            {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [],
              content: [
                {
                  type: 'reasoning_text',
                  text: 'Let me think step by step.',
                },
              ],
            },
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'The answer is 444.',
                  annotations: [],
                },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 15,
          },
        });

        const result = await createModel('grok-3-mini').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "xai": {
                  "itemId": "rs_456",
                },
              },
              "text": "Let me think step by step.",
              "type": "reasoning",
            },
            {
              "text": "The answer is 444.",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract reasoning with encrypted content but empty summary text', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'reasoning',
              id: 'rs_789',
              status: 'completed',
              summary: [],
              encrypted_content: 'encrypted_zdr_content_xyz',
            },
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Here is my response.',
                  annotations: [],
                },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            output_tokens_details: {
              reasoning_tokens: 15,
            },
          },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "xai": {
                  "itemId": "rs_789",
                  "reasoningEncryptedContent": "encrypted_zdr_content_xyz",
                },
              },
              "text": "",
              "type": "reasoning",
            },
            {
              "text": "Here is my response.",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('settings and options', () => {
      it('should send model id and settings', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        await createModel('grok-4-fast-non-reasoning').doGenerate({
          prompt: [
            { role: 'system', content: 'you are helpful' },
            { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          ],
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 100,
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": "you are helpful",
                "role": "system",
              },
              {
                "content": [
                  {
                    "text": "hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "max_output_tokens": 100,
            "model": "grok-4-fast-non-reasoning",
            "temperature": 0.5,
            "top_p": 0.9,
          }
        `);
      });

      describe('provider options', () => {
        it('reasoningEffort', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                reasoningEffort: 'high',
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.reasoning.effort).toBe('high');
        });

        it('reasoningEffort: "none"', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4.3',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                reasoningEffort: 'none',
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.reasoning.effort).toBe('none');
        });

        it('reasoningSummary', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                reasoningSummary: 'concise',
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.reasoning.summary).toBe('concise');
        });

        it('reasoningEffort and reasoningSummary together', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                reasoningEffort: 'high',
                reasoningSummary: 'detailed',
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.reasoning).toStrictEqual({
            effort: 'high',
            summary: 'detailed',
          });
        });

        it('logprobs and topLogprobs', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                logprobs: true,
                topLogprobs: 6,
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.logprobs).toBe(true);
          expect(requestBody.top_logprobs).toBe(6);
        });

        it('topLogprobs enables logprobs', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                topLogprobs: 2,
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.logprobs).toBe(true);
          expect(requestBody.top_logprobs).toBe(2);
        });

        it('store:true', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                store: true,
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.store).toBe(undefined);
          expect(requestBody.include).toBe(undefined);
        });

        it('store:false', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                store: false,
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.store).toBe(false);
          expect(requestBody.include).toStrictEqual([
            'reasoning.encrypted_content',
          ]);
        });

        it('previousResponseId', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                previousResponseId: 'resp_456',
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.previous_response_id).toBe('resp_456');
        });

        it('include with file_search_call.results', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                include: ['file_search_call.results'],
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.include).toStrictEqual([
            'file_search_call.results',
          ]);
        });

        it('include with file_search_call.results and store:false', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              xai: {
                include: ['file_search_call.results'],
                store: false,
              } satisfies XaiLanguageModelResponsesOptions,
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.store).toBe(false);
          expect(requestBody.include).toStrictEqual([
            'file_search_call.results',
            'reasoning.encrypted_content',
          ]);
        });
      });

      it('should warn about unsupported stopSequences', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          stopSequences: ['\n\n', 'STOP'],
        });

        expect(result.warnings).toMatchInlineSnapshot(`
          [
            {
              "feature": "stopSequences",
              "type": "unsupported",
            },
          ]
        `);
      });

      describe('responseFormat', () => {
        it('should send response format json schema', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            responseFormat: {
              type: 'json',
              name: 'recipe',
              description: 'A recipe object',
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  ingredients: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'ingredients'],
                additionalProperties: false,
              },
            },
          });

          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
            {
              "input": [
                {
                  "content": [
                    {
                      "text": "hello",
                      "type": "input_text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "model": "grok-4-fast-non-reasoning",
              "text": {
                "format": {
                  "description": "A recipe object",
                  "name": "recipe",
                  "schema": {
                    "additionalProperties": false,
                    "properties": {
                      "ingredients": {
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
                    ],
                    "type": "object",
                  },
                  "strict": true,
                  "type": "json_schema",
                },
              },
            }
          `);
        });

        it('should send response format json object when no schema provided', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
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
                      "text": "hello",
                      "type": "input_text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "model": "grok-4-fast-non-reasoning",
              "text": {
                "format": {
                  "type": "json_object",
                },
              },
            }
          `);
        });

        it('should use default name when responseFormat.name is not provided', async () => {
          prepareJsonResponse({
            id: 'resp_123',
            object: 'response',
            status: 'completed',
            model: 'grok-4-fast-non-reasoning',
            output: [],
            usage: { input_tokens: 10, output_tokens: 5 },
          });

          await createModel().doGenerate({
            prompt: TEST_PROMPT,
            responseFormat: {
              type: 'json',
              schema: {
                type: 'object',
                properties: { value: { type: 'string' } },
              },
            },
          });

          const requestBody = await server.calls[0].requestBodyJson;
          expect(requestBody.text.format.name).toBe('response');
        });
      });
    });

    describe('web_search tool', () => {
      let result: Awaited<
        ReturnType<(typeof createModel)['prototype']['doGenerate']>
      >;

      beforeEach(async () => {
        prepareJsonFixtureResponse('xai-web-search-tool.1');

        result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
          ],
        });
      });

      it('should include web_search tool call with providerExecuted true', async () => {
        expect(result.content).toMatchSnapshot();
      });

      it('should send web_search tool with args in request', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {
                allowedDomains: ['wikipedia.org'],
                enableImageSearch: true,
                enableImageUnderstanding: true,
              },
            },
          ],
        });

        expect(await server.calls[1].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "grok-4-fast-non-reasoning",
            "tools": [
              {
                "allowed_domains": [
                  "wikipedia.org",
                ],
                "enable_image_search": true,
                "enable_image_understanding": true,
                "type": "web_search",
              },
            ],
          }
        `);
      });
    });

    describe('x_search tool', () => {
      it('should include x_search tool call with real response', async () => {
        prepareJsonFixtureResponse('xai-x-search-tool.1');

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.x_search',
              name: 'x_search',
              args: {},
            },
          ],
        });

        expect(result.content).toMatchSnapshot();
      });
    });

    describe('code_interpreter tool', () => {
      it('should include code_interpreter tool call with real response', async () => {
        prepareJsonFixtureResponse('xai-code-execution-tool.1');

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        expect(result.content).toMatchSnapshot();
      });
    });

    describe('file_search tool', () => {
      it('should include file_search tool call and result with providerExecuted true', async () => {
        prepareJsonFixtureResponse('xai-file-search-tool.1');

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.file_search',
              name: 'file_search',
              args: {
                vectorStoreIds: ['collection_test123'],
              },
            },
          ],
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "",
              "providerExecuted": true,
              "toolCallId": "fs_123",
              "toolName": "file_search",
              "type": "tool-call",
            },
            {
              "result": {
                "queries": [
                  "AI safety research",
                ],
                "results": [
                  {
                    "fileId": "file_abc123",
                    "filename": "ai-safety-paper.pdf",
                    "score": 0.95,
                    "text": "Recent advances in AI safety research have focused on alignment techniques...",
                  },
                  {
                    "fileId": "file_def456",
                    "filename": "research-notes.md",
                    "score": 0.82,
                    "text": "Key findings from the AI safety workshop include recommendations for...",
                  },
                ],
              },
              "toolCallId": "fs_123",
              "toolName": "file_search",
              "type": "tool-result",
            },
            {
              "text": "Based on the documents in your collection, I found relevant information about AI safety research. The main findings indicate that recent advances have focused on alignment techniques and the workshop recommendations emphasize the importance of interpretability.",
              "type": "text",
            },
          ]
        `);
      });

      it('should handle file_search with null results', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'file_search_call',
              id: 'fs_456',
              status: 'completed',
              queries: ['nonexistent topic'],
              results: null,
            },
            {
              type: 'message',
              id: 'msg_456',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'No relevant documents found.',
                  annotations: [],
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 20 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.file_search',
              name: 'file_search',
              args: {
                vectorStoreIds: ['collection_test123'],
              },
            },
          ],
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "",
              "providerExecuted": true,
              "toolCallId": "fs_456",
              "toolName": "file_search",
              "type": "tool-call",
            },
            {
              "result": {
                "queries": [
                  "nonexistent topic",
                ],
                "results": null,
              },
              "toolCallId": "fs_456",
              "toolName": "file_search",
              "type": "tool-result",
            },
            {
              "text": "No relevant documents found.",
              "type": "text",
            },
          ]
        `);
      });
    });

    describe('function tools', () => {
      it('should include function tool calls without providerExecuted', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'function_call',
              id: 'fc_123',
              name: 'weather',
              arguments: '{"location":"sf"}',
              call_id: 'call_123',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'get weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
            },
          ],
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "{"location":"sf"}",
              "toolCallId": "call_123",
              "toolName": "weather",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should omit additionalProperties from serialized function tool schemas', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'saveContactWithAddress',
              description: 'Save a contact with an address.',
              inputSchema: {
                type: 'object',
                properties: {
                  address: {
                    type: 'object',
                    properties: {
                      city: { type: 'string' },
                      country: { type: 'string' },
                    },
                    required: ['city', 'country'],
                    additionalProperties: false,
                  },
                },
                required: ['address'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
            {
              type: 'function',
              name: 'saveContactWithProperties',
              description: 'Save a contact with a properties field.',
              inputSchema: {
                type: 'object',
                properties: {
                  properties: {
                    type: 'object',
                    properties: {
                      city: { type: 'string' },
                      country: { type: 'string' },
                    },
                    required: ['city', 'country'],
                    additionalProperties: false,
                  },
                },
                required: ['properties'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
          ],
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "hello",
                    "type": "input_text",
                  },
                ],
                "role": "user",
              },
            ],
            "model": "grok-4-fast-non-reasoning",
            "tools": [
              {
                "description": "Save a contact with an address.",
                "name": "saveContactWithAddress",
                "parameters": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "properties": {
                    "address": {
                      "properties": {
                        "city": {
                          "type": "string",
                        },
                        "country": {
                          "type": "string",
                        },
                      },
                      "required": [
                        "city",
                        "country",
                      ],
                      "type": "object",
                    },
                  },
                  "required": [
                    "address",
                  ],
                  "type": "object",
                },
                "type": "function",
              },
              {
                "description": "Save a contact with a properties field.",
                "name": "saveContactWithProperties",
                "parameters": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "properties": {
                    "properties": {
                      "properties": {
                        "city": {
                          "type": "string",
                        },
                        "country": {
                          "type": "string",
                        },
                      },
                      "required": [
                        "city",
                        "country",
                      ],
                      "type": "object",
                    },
                  },
                  "required": [
                    "properties",
                  ],
                  "type": "object",
                },
                "type": "function",
              },
            ],
          }
        `);
      });
    });

    describe('citations', () => {
      it('should extract citations from annotations', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'based on research',
                  annotations: [
                    {
                      type: 'url_citation',
                      url: 'https://example.com',
                      title: 'example title',
                    },
                    {
                      type: 'url_citation',
                      url: 'https://test.com',
                    },
                  ],
                },
              ],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "text": "based on research",
              "type": "text",
            },
            {
              "id": "id-0",
              "sourceType": "url",
              "title": "example title",
              "type": "source",
              "url": "https://example.com",
            },
            {
              "id": "id-1",
              "sourceType": "url",
              "title": "https://test.com",
              "type": "source",
              "url": "https://test.com",
            },
          ]
        `);
      });
    });

    describe('multiple tools', () => {
      it('should handle multiple server-side tools', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'web_search_call',
              id: 'ws_123',
              name: 'web_search',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
            {
              type: 'code_interpreter_call',
              id: 'code_123',
              name: 'code_execution',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        expect(result.content).toHaveLength(2);
        expect(result.content[0].type).toBe('tool-call');
        expect(result.content[1].type).toBe('tool-call');
      });
    });

    describe('tool name mapping by type', () => {
      it('should map web_search_call type to web_search tool name when name is empty', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'web_search_call',
              id: 'ws_123',
              name: '',
              arguments: '{"query":"test"}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
          ],
        });

        expect(result.content).toEqual([
          {
            type: 'tool-call',
            toolCallId: 'ws_123',
            toolName: 'web_search',
            input: '{"query":"test"}',
            providerExecuted: true,
          },
        ]);
      });

      it('should map x_search_call type to x_search tool name when name is empty', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'x_search_call',
              id: 'xs_123',
              name: '',
              arguments: '{"query":"test"}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.x_search',
              name: 'x_search',
              args: {},
            },
          ],
        });

        expect(result.content).toEqual([
          {
            type: 'tool-call',
            toolCallId: 'xs_123',
            toolName: 'x_search',
            input: '{"query":"test"}',
            providerExecuted: true,
          },
        ]);
      });

      it('should map code_interpreter_call type to code_execution tool name when name is empty', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'code_interpreter_call',
              id: 'ci_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        expect(result.content).toEqual([
          {
            type: 'tool-call',
            toolCallId: 'ci_123',
            toolName: 'code_execution',
            input: '{}',
            providerExecuted: true,
          },
        ]);
      });

      it('should map code_execution_call type to code_execution tool name when name is empty', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'code_execution_call',
              id: 'ce_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        expect(result.content).toEqual([
          {
            type: 'tool-call',
            toolCallId: 'ce_123',
            toolName: 'code_execution',
            input: '{}',
            providerExecuted: true,
          },
        ]);
      });

      it('should use custom tool name from provider tool when type matches', async () => {
        prepareJsonResponse({
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'grok-4-fast-non-reasoning',
          output: [
            {
              type: 'web_search_call',
              id: 'ws_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'my_custom_search',
              args: {},
            },
          ],
        });

        expect(result.content).toEqual([
          {
            type: 'tool-call',
            toolCallId: 'ws_123',
            toolName: 'my_custom_search',
            input: '{}',
            providerExecuted: true,
          },
        ]);
      });
    });
  });

  describe('doStream', () => {
    describe('text streaming', () => {
      it('should stream web search with real response', async () => {
        prepareChunksFixtureResponse('xai-web-search-tool.1');

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toMatchSnapshot();
      });

      it('should stream text deltas', async () => {
        prepareChunksFixtureResponse('xai-text-streaming.1');

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toMatchSnapshot();
      });

      it('should stream text deltas with reasoning', async () => {
        prepareChunksFixtureResponse('xai-text-with-reasoning-streaming.1');

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toMatchSnapshot();
      });

      it('should stream text deltas with encrypted reasoning', async () => {
        prepareChunksFixtureResponse(
          'xai-text-with-reasoning-streaming-store-false.1',
        );

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toMatchSnapshot();
      });

      it('should include encrypted content in reasoning-end providerMetadata', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'in_progress',
              summary: [],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_part.added',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 0,
            part: { type: 'summary_text', text: '' },
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_text.delta',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 0,
            delta: 'Analyzing...',
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_text.done',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 0,
            text: 'Analyzing...',
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [{ type: 'summary_text', text: 'Analyzing...' }],
              encrypted_content: 'encrypted_data_abc123',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'message',
              id: 'msg_789',
              role: 'assistant',
              status: 'in_progress',
              content: [],
            },
            output_index: 1,
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_789',
            output_index: 1,
            content_index: 0,
            delta: 'Result.',
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 20 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        const reasoningEnd = parts.find(part => part.type === 'reasoning-end');
        expect(reasoningEnd).toMatchInlineSnapshot(`
          {
            "id": "reasoning-rs_456",
            "providerMetadata": {
              "xai": {
                "itemId": "rs_456",
                "reasoningEncryptedContent": "encrypted_data_abc123",
              },
            },
            "type": "reasoning-end",
          }
        `);
      });

      it('should emit reasoning-start before reasoning-end when reasoning_summary_part.added is not sent', async () => {
        // This test covers the case where xAI sends encrypted reasoning without
        // streaming the reasoning summary text (no reasoning_summary_part.added events)
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'in_progress',
              summary: [],
            },
            output_index: 0,
          }),
          // Note: No response.reasoning_summary_part.added event
          // This happens with encrypted reasoning when store=false
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [],
              encrypted_content: 'encrypted_reasoning_content_xyz',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'message',
              id: 'msg_789',
              role: 'assistant',
              status: 'in_progress',
              content: [],
            },
            output_index: 1,
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_789',
            output_index: 1,
            content_index: 0,
            delta: 'The answer is 42.',
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 20 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        // Verify reasoning-start is emitted before reasoning-end
        const reasoningStart = parts.find(
          part => part.type === 'reasoning-start',
        );
        const reasoningEnd = parts.find(part => part.type === 'reasoning-end');

        expect(reasoningStart).toMatchInlineSnapshot(`
          {
            "id": "reasoning-rs_456",
            "providerMetadata": {
              "xai": {
                "itemId": "rs_456",
              },
            },
            "type": "reasoning-start",
          }
        `);

        expect(reasoningEnd).toMatchInlineSnapshot(`
          {
            "id": "reasoning-rs_456",
            "providerMetadata": {
              "xai": {
                "itemId": "rs_456",
                "reasoningEncryptedContent": "encrypted_reasoning_content_xyz",
              },
            },
            "type": "reasoning-end",
          }
        `);

        // Verify reasoning-start comes before reasoning-end in the stream
        const reasoningStartIndex = parts.findIndex(
          part => part.type === 'reasoning-start',
        );
        const reasoningEndIndex = parts.findIndex(
          part => part.type === 'reasoning-end',
        );
        expect(reasoningStartIndex).toBeLessThan(reasoningEndIndex);
      });

      it('should stream reasoning text deltas (response.reasoning_text.delta)', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-code-fast-1',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'in_progress',
              summary: [],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.reasoning_text.delta',
            item_id: 'rs_456',
            output_index: 0,
            content_index: 0,
            delta: 'First',
          }),
          JSON.stringify({
            type: 'response.reasoning_text.delta',
            item_id: 'rs_456',
            output_index: 0,
            content_index: 0,
            delta: ', analyze the question.',
          }),
          JSON.stringify({
            type: 'response.reasoning_text.done',
            item_id: 'rs_456',
            output_index: 0,
            content_index: 0,
            text: 'First, analyze the question.',
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [
                { type: 'summary_text', text: 'First, analyze the question.' },
              ],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'message',
              id: 'msg_789',
              role: 'assistant',
              status: 'in_progress',
              content: [],
            },
            output_index: 1,
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_789',
            output_index: 1,
            content_index: 0,
            delta: 'The answer.',
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-code-fast-1',
              status: 'completed',
              output: [],
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                output_tokens_details: { reasoning_tokens: 15 },
              },
            },
          }),
        ]);

        const { stream } = await createModel('grok-code-fast-1').doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        const reasoningStart = parts.find(
          part => part.type === 'reasoning-start',
        );
        expect(reasoningStart).toMatchInlineSnapshot(`
          {
            "id": "reasoning-rs_456",
            "providerMetadata": {
              "xai": {
                "itemId": "rs_456",
              },
            },
            "type": "reasoning-start",
          }
        `);

        const reasoningDeltas = parts.filter(
          part => part.type === 'reasoning-delta',
        );
        expect(reasoningDeltas).toHaveLength(2);
        expect(reasoningDeltas[0].delta).toBe('First');
        expect(reasoningDeltas[1].delta).toBe(', analyze the question.');

        const reasoningEnd = parts.find(part => part.type === 'reasoning-end');
        expect(reasoningEnd).toMatchInlineSnapshot(`
          {
            "id": "reasoning-rs_456",
            "providerMetadata": {
              "xai": {
                "itemId": "rs_456",
              },
            },
            "type": "reasoning-end",
          }
        `);

        // Verify ordering: reasoning-start < reasoning-deltas < reasoning-end < text
        const startIdx = parts.findIndex(p => p.type === 'reasoning-start');
        const firstDeltaIdx = parts.findIndex(
          p => p.type === 'reasoning-delta',
        );
        const endIdx = parts.findIndex(p => p.type === 'reasoning-end');
        const textIdx = parts.findIndex(p => p.type === 'text-delta');
        expect(startIdx).toBeLessThan(firstDeltaIdx);
        expect(firstDeltaIdx).toBeLessThan(endIdx);
        expect(endIdx).toBeLessThan(textIdx);
      });

      it('should emit only one reasoning-start when multiple reasoning_summary_part.added events share an item_id', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4.3',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'in_progress',
              summary: [],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_part.added',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 0,
            part: { type: 'summary_text', text: '' },
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_text.delta',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 0,
            delta: 'First summary part.',
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_part.added',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 1,
            part: { type: 'summary_text', text: '' },
          }),
          JSON.stringify({
            type: 'response.reasoning_summary_text.delta',
            item_id: 'rs_456',
            output_index: 0,
            summary_index: 1,
            delta: ' Second summary part.',
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'reasoning',
              id: 'rs_456',
              status: 'completed',
              summary: [
                { type: 'summary_text', text: 'First summary part.' },
                { type: 'summary_text', text: ' Second summary part.' },
              ],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4.3',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 20 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        const reasoningStarts = parts.filter(p => p.type === 'reasoning-start');
        const reasoningEnds = parts.filter(p => p.type === 'reasoning-end');

        expect(reasoningStarts).toHaveLength(1);
        expect(reasoningEnds).toHaveLength(1);
        expect(reasoningStarts[0]).toMatchObject({
          type: 'reasoning-start',
          id: 'reasoning-rs_456',
          providerMetadata: { xai: { itemId: 'rs_456' } },
        });
      });

      it('should stream x_search tool call', async () => {
        prepareChunksFixtureResponse('xai-x-search-tool');

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.x_search',
              name: 'x_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toMatchSnapshot();
      });

      it('should not emit duplicate text-delta from response.output_item.done after streaming', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              created_at: 1700000000,
              status: 'in_progress',
              output: [],
            },
          }),
          // Message item added - should emit text-start
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'message',
              id: 'msg_123',
              status: 'in_progress',
              role: 'assistant',
              content: [],
            },
            output_index: 0,
          }),
          // Stream text deltas
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_123',
            output_index: 0,
            content_index: 0,
            delta: 'Hello',
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_123',
            output_index: 0,
            content_index: 0,
            delta: ' ',
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            item_id: 'msg_123',
            output_index: 0,
            content_index: 0,
            delta: 'world',
          }),
          // Message item done - should NOT emit text-delta with full text
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'message',
              id: 'msg_123',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'Hello world', // Full accumulated text
                  annotations: [],
                },
              ],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        // Count text-delta events
        const textDeltas = parts.filter(part => part.type === 'text-delta');

        // Should only have 3 text-deltas from streaming, NOT 4 (with duplicate full text)
        expect(textDeltas).toHaveLength(3);
        expect(textDeltas.map(d => d.delta)).toEqual(['Hello', ' ', 'world']);

        // Verify there's no text-delta with the full accumulated text
        const fullTextDelta = textDeltas.find(d => d.delta === 'Hello world');
        expect(fullTextDelta).toBeUndefined();
      });
    });

    describe('tool call streaming', () => {
      it('should stream web_search tool calls', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'web_search_call',
              id: 'ws_123',
              name: 'web_search',
              arguments: '{"query":"test"}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'ws_123',
          toolName: 'web_search',
          input: '{"query":"test"}',
          providerExecuted: true,
        });
      });

      it('should stream function tool call arguments', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              type: 'function_call',
              id: 'fc_123',
              call_id: 'call_123',
              name: 'weather',
              arguments: '',
              status: 'in_progress',
            },
          }),
          JSON.stringify({
            type: 'response.function_call_arguments.delta',
            item_id: 'fc_123',
            output_index: 0,
            delta: '{"location"',
          }),
          JSON.stringify({
            type: 'response.function_call_arguments.delta',
            item_id: 'fc_123',
            output_index: 0,
            delta: ':"sf"}',
          }),
          JSON.stringify({
            type: 'response.function_call_arguments.done',
            item_id: 'fc_123',
            output_index: 0,
            arguments: '{"location":"sf"}',
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            output_index: 0,
            item: {
              type: 'function_call',
              id: 'fc_123',
              call_id: 'call_123',
              name: 'weather',
              arguments: '{"location":"sf"}',
              status: 'completed',
            },
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'get weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-input-start',
          id: 'call_123',
          toolName: 'weather',
        });
        expect(parts).toContainEqual({
          type: 'tool-input-delta',
          id: 'call_123',
          delta: '{"location"',
        });
        expect(parts).toContainEqual({
          type: 'tool-input-delta',
          id: 'call_123',
          delta: ':"sf"}',
        });
        expect(parts).toContainEqual({
          type: 'tool-input-end',
          id: 'call_123',
        });
        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'weather',
          input: '{"location":"sf"}',
        });
      });

      it('should return tool-calls finish reason when function_call is streamed', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              type: 'function_call',
              id: 'fc_123',
              call_id: 'call_123',
              name: 'weather',
              arguments: '',
              status: 'in_progress',
            },
          }),
          JSON.stringify({
            type: 'response.function_call_arguments.done',
            item_id: 'fc_123',
            output_index: 0,
            arguments: '{"location":"sf"}',
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            output_index: 0,
            item: {
              type: 'function_call',
              id: 'fc_123',
              call_id: 'call_123',
              name: 'weather',
              arguments: '{"location":"sf"}',
              status: 'completed',
            },
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'get weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);
        const finishPart = parts.find(p => p.type === 'finish');

        expect(finishPart).toMatchObject({
          type: 'finish',
          finishReason: {
            unified: 'tool-calls',
            raw: 'completed',
          },
        });
      });

      it('should stream file_search tool call and result', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'file_search_call',
              id: 'fs_stream_123',
              status: 'in_progress',
              queries: ['search query'],
              results: null,
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.output_item.done',
            item: {
              type: 'file_search_call',
              id: 'fs_stream_123',
              status: 'completed',
              queries: ['search query'],
              results: [
                {
                  file_id: 'file_abc',
                  filename: 'doc.txt',
                  score: 0.9,
                  text: 'Found text content',
                },
              ],
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.file_search',
              name: 'file_search',
              args: {
                vectorStoreIds: ['collection_123'],
              },
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-input-start',
          id: 'fs_stream_123',
          toolName: 'file_search',
        });

        expect(parts).toContainEqual({
          type: 'tool-input-delta',
          id: 'fs_stream_123',
          delta: '',
        });

        expect(parts).toContainEqual({
          type: 'tool-input-end',
          id: 'fs_stream_123',
        });

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'fs_stream_123',
          toolName: 'file_search',
          input: '',
          providerExecuted: true,
        });

        expect(parts).toContainEqual({
          type: 'tool-result',
          toolCallId: 'fs_stream_123',
          toolName: 'file_search',
          result: {
            queries: ['search query'],
            results: [
              {
                fileId: 'file_abc',
                filename: 'doc.txt',
                score: 0.9,
                text: 'Found text content',
              },
            ],
          },
        });
      });
    });

    describe('tool name mapping by type in streaming', () => {
      it('should map web_search_call type to web_search tool name when name is empty', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'web_search_call',
              id: 'ws_123',
              name: '',
              arguments: '{"query":"test"}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'web_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'ws_123',
          toolName: 'web_search',
          input: '{"query":"test"}',
          providerExecuted: true,
        });
      });

      it('should map x_search_call type to x_search tool name when name is empty', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'x_search_call',
              id: 'xs_123',
              name: '',
              arguments: '{"query":"test"}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.x_search',
              name: 'x_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'xs_123',
          toolName: 'x_search',
          input: '{"query":"test"}',
          providerExecuted: true,
        });
      });

      it('should map code_interpreter_call type to code_execution tool name when name is empty', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'code_interpreter_call',
              id: 'ci_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'ci_123',
          toolName: 'code_execution',
          input: '{}',
          providerExecuted: true,
        });
      });

      it('should map code_execution_call type to code_execution tool name when name is empty', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'code_execution_call',
              id: 'ce_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.code_execution',
              name: 'code_execution',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'ce_123',
          toolName: 'code_execution',
          input: '{}',
          providerExecuted: true,
        });
      });

      it('should use custom tool name from provider tool when type matches', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_item.added',
            item: {
              type: 'web_search_call',
              id: 'ws_123',
              name: '',
              arguments: '{}',
              call_id: '',
              status: 'completed',
            },
            output_index: 0,
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'provider',
              id: 'xai.web_search',
              name: 'my_custom_search',
              args: {},
            },
          ],
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'tool-call',
          toolCallId: 'ws_123',
          toolName: 'my_custom_search',
          input: '{}',
          providerExecuted: true,
        });
      });
    });

    describe('citation streaming', () => {
      it('should stream citations as sources', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_text.annotation.added',
            item_id: 'msg_123',
            output_index: 0,
            content_index: 0,
            annotation_index: 0,
            annotation: {
              type: 'url_citation',
              url: 'https://example.com',
              title: 'example',
            },
          }),
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              object: 'response',
              status: 'completed',
              output: [],
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);

        expect(parts).toContainEqual({
          type: 'source',
          sourceType: 'url',
          id: 'id-0',
          url: 'https://example.com',
          title: 'example',
        });
      });
    });

    describe('cost_in_usd_ticks streaming', () => {
      it('should expose cost_in_usd_ticks in finish providerMetadata', async () => {
        prepareStreamChunks([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            output_index: 0,
            content_index: 0,
            delta: 'Hello',
          }),
          JSON.stringify({
            type: 'response.completed',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              status: 'completed',
              output: [
                {
                  type: 'message',
                  id: 'msg_001',
                  role: 'assistant',
                  status: 'completed',
                  content: [{ type: 'output_text', text: 'Hello' }],
                },
              ],
              usage: {
                input_tokens: 10,
                output_tokens: 5,
                cost_in_usd_ticks: 113500,
              },
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);
        const finishPart = parts.find(p => p.type === 'finish');

        expect(finishPart).toMatchObject({
          type: 'finish',
          providerMetadata: {
            xai: { costInUsdTicks: 113500 },
          },
        });
      });
    });

    describe('missing usage handling', () => {
      function prepareStreamChunksNoUsage(chunks: string[]) {
        server.urls['https://api.x.ai/v1/responses'].response = {
          type: 'stream-chunks',
          chunks: [...chunks.map(c => `data: ${c}\n\n`), 'data: [DONE]\n\n'],
        };
      }

      it('should handle missing usage in streaming response', async () => {
        prepareStreamChunksNoUsage([
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              created_at: 1700000000,
              status: 'in_progress',
              output: [],
            },
          }),
          JSON.stringify({
            type: 'response.output_text.delta',
            output_index: 0,
            content_index: 0,
            delta: 'Hello',
          }),
          JSON.stringify({
            type: 'response.completed',
            response: {
              id: 'resp_123',
              object: 'response',
              model: 'grok-4-fast-non-reasoning',
              created_at: 1700000000,
              status: 'completed',
              output: [
                {
                  type: 'message',
                  id: 'msg_001',
                  role: 'assistant',
                  status: 'completed',
                  content: [{ type: 'output_text', text: 'Hello' }],
                },
              ],
              // usage field is omitted
            },
          }),
        ]);

        const { stream } = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        const parts = await convertReadableStreamToArray(stream);
        const finishPart = parts.find(p => p.type === 'finish');

        expect(finishPart).toMatchObject({
          type: 'finish',
          finishReason: {
            unified: 'stop',
            raw: 'completed',
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
    });
  });

  describe('schema validation', () => {
    it('should accept response.created with usage: null', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            created_at: 1700000000,
            status: 'in_progress',
            output: [],
            usage: null,
          },
        }),
        JSON.stringify({
          type: 'response.output_item.added',
          item: {
            id: 'msg_001',
            type: 'message',
            role: 'assistant',
            content: [],
            status: 'in_progress',
          },
          output_index: 0,
        }),
        JSON.stringify({
          type: 'response.content_part.added',
          item_id: 'msg_001',
          output_index: 0,
          content_index: 0,
          part: { type: 'output_text', text: '' },
        }),
        JSON.stringify({
          type: 'response.output_text.delta',
          item_id: 'msg_001',
          output_index: 0,
          content_index: 0,
          delta: 'Hello',
        }),
        JSON.stringify({
          type: 'response.completed',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            created_at: 1700000000,
            status: 'completed',
            output: [
              {
                id: 'msg_001',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'Hello' }],
                status: 'completed',
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);

      expect(parts).toContainEqual(
        expect.objectContaining({
          type: 'text-delta',
          delta: 'Hello',
        }),
      );

      expect(parts).toContainEqual(
        expect.objectContaining({
          type: 'finish',
        }),
      );
    });

    it('should accept response.in_progress with usage: null', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            created_at: 1700000000,
            status: 'in_progress',
            output: [],
            usage: null,
          },
        }),
        JSON.stringify({
          type: 'response.in_progress',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            created_at: 1700000000,
            status: 'in_progress',
            output: [],
            usage: null,
          },
        }),
        JSON.stringify({
          type: 'response.output_item.added',
          item: {
            id: 'msg_001',
            type: 'message',
            role: 'assistant',
            content: [],
            status: 'in_progress',
          },
          output_index: 0,
        }),
        JSON.stringify({
          type: 'response.content_part.added',
          item_id: 'msg_001',
          output_index: 0,
          content_index: 0,
          part: { type: 'output_text', text: '' },
        }),
        JSON.stringify({
          type: 'response.output_text.delta',
          item_id: 'msg_001',
          output_index: 0,
          content_index: 0,
          delta: 'Hi',
        }),
        JSON.stringify({
          type: 'response.completed',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            created_at: 1700000000,
            status: 'completed',
            output: [
              {
                id: 'msg_001',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'Hi' }],
                status: 'completed',
              },
            ],
            usage: {
              input_tokens: 5,
              output_tokens: 1,
              total_tokens: 6,
            },
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);

      expect(parts).toContainEqual(
        expect.objectContaining({
          type: 'text-delta',
          delta: 'Hi',
        }),
      );
    });
  });

  describe('response.incomplete handling', () => {
    it('should set finish reason to length for max_output_tokens', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            output: [],
          },
        }),
        JSON.stringify({
          type: 'response.output_text.delta',
          item_id: 'msg_456',
          output_index: 0,
          content_index: 0,
          delta: 'partial output',
        }),
        JSON.stringify({
          type: 'response.incomplete',
          response: {
            incomplete_details: { reason: 'max_output_tokens' },
            usage: { input_tokens: 100, output_tokens: 4096 },
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(part => part.type === 'finish');

      expect(finish).toMatchObject({
        type: 'finish',
        finishReason: {
          unified: 'length',
          raw: 'max_output_tokens',
        },
        usage: expect.objectContaining({
          inputTokens: expect.objectContaining({ total: 100 }),
          outputTokens: expect.objectContaining({ total: 4096 }),
        }),
      });
    });

    it('should default to length when incomplete_details is missing', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            output: [],
          },
        }),
        JSON.stringify({
          type: 'response.incomplete',
          response: {
            usage: { input_tokens: 50, output_tokens: 200 },
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(part => part.type === 'finish');

      expect(finish).toMatchObject({
        type: 'finish',
        finishReason: {
          unified: 'other',
          raw: 'incomplete',
        },
      });
    });
  });

  describe('response.failed handling', () => {
    it('should set finish reason to error', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            output: [],
          },
        }),
        JSON.stringify({
          type: 'response.failed',
          response: {
            error: {
              code: 'server_error',
              message: 'Internal server error',
            },
            usage: { input_tokens: 50, output_tokens: 0 },
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(part => part.type === 'finish');

      expect(finish).toMatchObject({
        type: 'finish',
        finishReason: {
          unified: 'error',
          raw: 'error',
        },
        usage: expect.objectContaining({
          inputTokens: expect.objectContaining({ total: 50 }),
          outputTokens: expect.objectContaining({ total: 0 }),
        }),
      });
    });

    it('should map incomplete_details reason on failed response', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            output: [],
          },
        }),
        JSON.stringify({
          type: 'response.failed',
          response: {
            error: {
              code: 'server_error',
              message: 'response failed',
            },
            incomplete_details: { reason: 'max_output_tokens' },
            usage: null,
          },
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(part => part.type === 'finish');

      expect(finish).toMatchObject({
        type: 'finish',
        finishReason: {
          unified: 'length',
          raw: 'max_output_tokens',
        },
      });
    });
  });

  describe('error event handling', () => {
    it('should emit error chunk for server error events', async () => {
      prepareStreamChunks([
        JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_123',
            object: 'response',
            model: 'grok-4-fast-non-reasoning',
            output: [],
          },
        }),
        JSON.stringify({
          type: 'error',
          code: null,
          message:
            'Service temporarily unavailable. The model did not respond to this request.',
          param: null,
        }),
      ]);

      const { stream } = await createModel().doStream({
        prompt: TEST_PROMPT,
      });

      const parts = await convertReadableStreamToArray(stream);
      const errorPart = parts.find(part => part.type === 'error');

      expect(errorPart).toMatchObject({
        type: 'error',
        error: {
          type: 'error',
          code: null,
          message:
            'Service temporarily unavailable. The model did not respond to this request.',
          param: null,
        },
      });
    });
  });
});
