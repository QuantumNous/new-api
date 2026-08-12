import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeepSeek } from '../deepseek-provider';
import type { DeepSeekLanguageModelChatOptions } from './deepseek-chat-language-model-options';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createDeepSeek({
  apiKey: 'test-api-key',
});

const server = createTestServer({
  'https://api.deepseek.com/chat/completions': {},
});

describe('DeepSeekChatLanguageModel', () => {
  describe('doGenerate', () => {
    function prepareJsonFixtureResponse(filename: string) {
      server.urls['https://api.deepseek.com/chat/completions'].response = {
        type: 'json-value',
        body: JSON.parse(
          fs.readFileSync(`src/chat/__fixtures__/${filename}.json`, 'utf8'),
        ),
      };
      return;
    }

    describe('text', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('deepseek-text');
      });

      it('should send correct request body', async () => {
        await provider.chat('deepseek-chat').doGenerate({
          prompt: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
          temperature: 0.5,
          topP: 0.3,
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "messages": [
              {
                "content": "You are a helpful assistant.",
                "role": "system",
              },
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "deepseek-chat",
            "temperature": 0.5,
            "top_p": 0.3,
          }
        `);
      });

      it('should extract text content', async () => {
        const result = await provider.chat('deepseek-chat').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result).toMatchSnapshot();
      });
    });

    describe('reasoning', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('deepseek-reasoning');
      });

      it('should send correct request body', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'How many "r"s are in the word "strawberry"?',
                },
              ],
            },
          ],
          providerOptions: {
            deepseek: {
              thinking: { type: 'enabled' },
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "messages": [
              {
                "content": "How many "r"s are in the word "strawberry"?",
                "role": "user",
              },
            ],
            "model": "deepseek-reasoner",
            "thinking": {
              "type": "enabled",
            },
          }
        `);
      });

      it('should extract text content', async () => {
        const result = await provider.chat('deepseek-chat').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result).toMatchSnapshot();
      });
    });

    describe('top-level reasoning', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('deepseek-text');
      });

      it('should map top-level reasoning to thinking enabled', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.thinking).toStrictEqual({
          type: 'enabled',
        });
        expect(requestBody.reasoning_effort).toBe('high');
      });

      it('should map top-level reasoning none to thinking disabled', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'none',
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.thinking).toStrictEqual({
          type: 'disabled',
        });
        expect(requestBody.reasoning_effort).toBeUndefined();
      });

      it('should map top-level reasoning xhigh to reasoning_effort max', async () => {
        const result = await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'xhigh',
        });

        expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
          'max',
        );
        expect(result.warnings).toContainEqual({
          type: 'compatibility',
          feature: 'reasoning',
          details:
            'reasoning "xhigh" is not directly supported by this model. mapped to effort "max".',
        });
      });

      it('should map top-level reasoning low to reasoning_effort low without a compatibility warning', async () => {
        const result = await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'low',
        });

        expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
          'low',
        );
        expect(result.warnings).not.toContainEqual(
          expect.objectContaining({
            type: 'compatibility',
            feature: 'reasoning',
          }),
        );
      });

      it('should map top-level reasoning medium to reasoning_effort medium', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'medium',
        });

        expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
          'medium',
        );
      });

      it('should map top-level reasoning minimal to reasoning_effort low with compatibility warning', async () => {
        const result = await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'minimal',
        });

        expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
          'low',
        );
        expect(result.warnings).toContainEqual({
          type: 'compatibility',
          feature: 'reasoning',
          details:
            'reasoning "minimal" is not directly supported by this model. mapped to effort "low".',
        });
      });

      it.each(['low', 'medium', 'xhigh'] as const)(
        'should pass providerOptions reasoningEffort %s through to the API',
        async effort => {
          await provider.chat('deepseek-reasoner').doGenerate({
            prompt: TEST_PROMPT,
            providerOptions: {
              deepseek: {
                reasoningEffort: effort,
              } satisfies DeepSeekLanguageModelChatOptions,
            },
          });

          expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
            effort,
          );
        },
      );

      it('should pass providerOptions thinking.type=adaptive through to the API', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            deepseek: {
              thinking: { type: 'adaptive' },
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect((await server.calls[0].requestBodyJson).thinking).toStrictEqual({
          type: 'adaptive',
        });
      });

      it('should pass providerOptions reasoningEffort', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            deepseek: {
              reasoningEffort: 'max',
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        const requestBody = await server.calls[0].requestBodyJson;
        expect(requestBody.reasoning_effort).toBe('max');
        // When only reasoningEffort is set without thinking, thinking should be
        // undefined and rely on the API default (enabled).
        expect(requestBody.thinking).toBeUndefined();
      });

      it('should prefer providerOptions thinking over top-level reasoning', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'none',
          providerOptions: {
            deepseek: {
              thinking: { type: 'enabled' },
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect((await server.calls[0].requestBodyJson).thinking).toStrictEqual({
          type: 'enabled',
        });
      });

      it('should prefer providerOptions reasoningEffort over top-level reasoning', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
          providerOptions: {
            deepseek: {
              reasoningEffort: 'max',
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect((await server.calls[0].requestBodyJson).reasoning_effort).toBe(
          'max',
        );
      });

      it('should not set thinking when reasoning is not specified', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(
          (await server.calls[0].requestBodyJson).thinking,
        ).toBeUndefined();
      });
    });

    describe('tool call', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('deepseek-tool-call');
      });

      it('should send correct request body', async () => {
        await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
          ],
          providerOptions: {
            deepseek: {
              thinking: { type: 'enabled' },
            } satisfies DeepSeekLanguageModelChatOptions,
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
            "model": "deepseek-reasoner",
            "thinking": {
              "type": "enabled",
            },
            "tools": [
              {
                "function": {
                  "name": "weather",
                  "parameters": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
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
                },
                "type": "function",
              },
            ],
          }
        `);
      });

      describe('json response format', () => {
        beforeEach(() => {
          prepareJsonFixtureResponse('deepseek-json');
        });

        it('should send correct request body without schema', async () => {
          await provider.chat('deepseek-reasoner').doGenerate({
            prompt: TEST_PROMPT,
            responseFormat: { type: 'json' },
            tools: [
              {
                type: 'function',
                name: 'weather',
                inputSchema: {
                  type: 'object',
                  properties: { location: { type: 'string' } },
                  required: ['location'],
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
              },
            ],
            providerOptions: {
              deepseek: {
                thinking: { type: 'enabled' },
              } satisfies DeepSeekLanguageModelChatOptions,
            },
          });

          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
            {
              "messages": [
                {
                  "content": "Return JSON.",
                  "role": "system",
                },
                {
                  "content": "Hello",
                  "role": "user",
                },
              ],
              "model": "deepseek-reasoner",
              "response_format": {
                "type": "json_object",
              },
              "thinking": {
                "type": "enabled",
              },
              "tools": [
                {
                  "function": {
                    "name": "weather",
                    "parameters": {
                      "$schema": "http://json-schema.org/draft-07/schema#",
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
                  },
                  "type": "function",
                },
              ],
            }
          `);
        });

        it('should send correct request body with schema', async () => {
          await provider.chat('deepseek-reasoner').doGenerate({
            prompt: TEST_PROMPT,
            responseFormat: {
              type: 'json',
              schema: {
                type: 'object',
                properties: {
                  elements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        location: { type: 'string' },
                        temperature: { type: 'number' },
                        condition: { type: 'string' },
                      },
                      required: ['location', 'temperature', 'condition'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['elements'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
            tools: [
              {
                type: 'function',
                name: 'weather',
                inputSchema: {
                  type: 'object',
                  properties: { location: { type: 'string' } },
                  required: ['location'],
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
              },
            ],
            providerOptions: {
              deepseek: {
                thinking: { type: 'enabled' },
              } satisfies DeepSeekLanguageModelChatOptions,
            },
          });

          expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
            {
              "messages": [
                {
                  "content": "Return JSON that conforms to the following schema: {"type":"object","properties":{"elements":{"type":"array","items":{"type":"object","properties":{"location":{"type":"string"},"temperature":{"type":"number"},"condition":{"type":"string"}},"required":["location","temperature","condition"],"additionalProperties":false}}},"required":["elements"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}",
                  "role": "system",
                },
                {
                  "content": "Hello",
                  "role": "user",
                },
              ],
              "model": "deepseek-reasoner",
              "response_format": {
                "type": "json_object",
              },
              "thinking": {
                "type": "enabled",
              },
              "tools": [
                {
                  "function": {
                    "name": "weather",
                    "parameters": {
                      "$schema": "http://json-schema.org/draft-07/schema#",
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
                  },
                  "type": "function",
                },
              ],
            }
          `);
        });

        it('should extract text content', async () => {
          const result = await provider.chat('deepseek-reasoner').doGenerate({
            prompt: TEST_PROMPT,
            responseFormat: { type: 'json' },
            tools: [
              {
                type: 'function',
                name: 'weather',
                inputSchema: {
                  type: 'object',
                  properties: { location: { type: 'string' } },
                  required: ['location'],
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
              },
            ],
            providerOptions: {
              deepseek: {
                thinking: { type: 'enabled' },
              } satisfies DeepSeekLanguageModelChatOptions,
            },
          });

          expect(result).toMatchSnapshot();
        });
      });

      it('should extract tool call content', async () => {
        const result = await provider.chat('deepseek-reasoner').doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
          ],
          providerOptions: {
            deepseek: {
              thinking: { type: 'enabled' },
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('doStream', () => {
    function prepareChunksFixtureResponse(filename: string) {
      const chunks = fs
        .readFileSync(`src/chat/__fixtures__/${filename}.chunks.txt`, 'utf8')
        .split('\n')
        .map(line => `data: ${line}\n\n`);
      chunks.push('data: [DONE]\n\n');

      server.urls['https://api.deepseek.com/chat/completions'].response = {
        type: 'stream-chunks',
        chunks,
      };
    }

    describe('text', () => {
      beforeEach(() => {
        prepareChunksFixtureResponse('deepseek-text');
      });

      it('should send model id, settings, and input', async () => {
        await provider.chat('deepseek-chat').doStream({
          prompt: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
          temperature: 0.5,
          topP: 0.3,
        });

        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "messages": [
              {
                "content": "You are a helpful assistant.",
                "role": "system",
              },
              {
                "content": "Hello",
                "role": "user",
              },
            ],
            "model": "deepseek-chat",
            "stream": true,
            "stream_options": {
              "include_usage": true,
            },
            "temperature": 0.5,
            "top_p": 0.3,
          }
        `);
      });

      it('should stream text', async () => {
        const result = await provider.chat('deepseek-chat').doStream({
          prompt: TEST_PROMPT,
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('reasoning', () => {
      beforeEach(() => {
        prepareChunksFixtureResponse('deepseek-reasoning');
      });

      it('should stream reasoning', async () => {
        const result = await provider.chat('deepseek-reasoning').doStream({
          prompt: TEST_PROMPT,
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('tool call', () => {
      beforeEach(() => {
        prepareChunksFixtureResponse('deepseek-tool-call');
      });

      it('should stream tool call', async () => {
        const result = await provider.chat('deepseek-reasoner').doStream({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#',
              },
            },
          ],
          providerOptions: {
            deepseek: {
              thinking: { type: 'enabled' },
            } satisfies DeepSeekLanguageModelChatOptions,
          },
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });
  });
});
