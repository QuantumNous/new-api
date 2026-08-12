import type {
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { OpenResponsesLanguageModel } from './open-responses-language-model';

describe('OpenResponsesLanguageModel', () => {
  const TEST_PROMPT: LanguageModelV4Prompt = [
    { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
  ];

  const URL = 'https://localhost:1234/v1/responses';

  const server = createTestServer({
    [URL]: {},
  });

  function createModel(modelId: string = 'gemma-7b-it') {
    return new OpenResponsesLanguageModel(modelId, {
      provider: 'lmstudio',
      providerOptionsName: 'lmstudio',
      url: URL,
      headers: () => ({}),
      generateId: mockId(),
    });
  }

  describe('doGenerate', () => {
    function prepareJsonFixtureResponse(filename: string) {
      server.urls[URL].response = {
        type: 'json-value',
        body: JSON.parse(
          fs.readFileSync(
            `src/responses/__fixtures__/${filename}.json`,
            'utf8',
          ),
        ),
      };
      return;
    }

    describe('basic generation', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });
      });

      it('should send correct request body', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });

      it('should produce correct content', async () => {
        expect(result.content).toMatchSnapshot();
      });

      it('should extract usage correctly', async () => {
        expect(result.usage).toMatchSnapshot();
      });
    });

    describe('request parameters', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          maxOutputTokens: 100,
          temperature: 0.5,
          topP: 0.9,
          presencePenalty: 0.1,
          frequencyPenalty: 0.2,
          responseFormat: {
            type: 'json',
            name: 'response',
            description: 'Example response schema',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string' },
              },
              required: ['status'],
            },
          },
        });
      });

      it('should send correct request body', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });
    });

    describe('tools', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              description: 'Get the current weather for a location',
              inputSchema: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'The city and state',
                  },
                },
                required: ['location'],
              },
            },
            {
              type: 'function',
              name: 'search',
              description: 'Search for information',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                  },
                },
                required: ['query'],
              },
              strict: true,
            },
          ],
        });
      });

      it('should send correct request body with tools', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });
    });

    describe('top-level reasoning', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('lmstudio-basic.1');
      });

      it('should map top-level reasoning to reasoning effort', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
        });

        expect((await server.calls[0].requestBodyJson).reasoning).toStrictEqual(
          { effort: 'high' },
        );
      });

      it('should coerce top-level reasoning minimal to low', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'minimal',
        });

        expect((await server.calls[0].requestBodyJson).reasoning).toStrictEqual(
          { effort: 'low' },
        );
      });

      it('should map top-level reasoning none to none', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'none',
        });

        expect((await server.calls[0].requestBodyJson).reasoning).toStrictEqual(
          { effort: 'none' },
        );
      });

      it('should pass xhigh directly', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'xhigh',
        });

        expect((await server.calls[0].requestBodyJson).reasoning).toStrictEqual(
          { effort: 'xhigh' },
        );
      });

      it('should not set reasoning when not specified', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(
          (await server.calls[0].requestBodyJson).reasoning,
        ).toBeUndefined();
      });
    });

    describe('providerOptions reasoning', () => {
      beforeEach(() => {
        prepareJsonFixtureResponse('lmstudio-basic.1');
      });

      it('should send reasoning.summary via providerOptions', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            lmstudio: { reasoningSummary: 'detailed' },
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
                "type": "message",
              },
            ],
            "model": "gemma-7b-it",
            "reasoning": {
              "summary": "detailed",
            },
          }
        `);
      });

      it('should combine top-level reasoning effort with providerOptions summary', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
          providerOptions: {
            lmstudio: { reasoningSummary: 'auto' },
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
                "type": "message",
              },
            ],
            "model": "gemma-7b-it",
            "reasoning": {
              "effort": "high",
              "summary": "auto",
            },
          }
        `);
      });

      it('should send reasoning.summary concise via providerOptions', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            lmstudio: { reasoningSummary: 'concise' },
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
                "type": "message",
              },
            ],
            "model": "gemma-7b-it",
            "reasoning": {
              "summary": "concise",
            },
          }
        `);
      });

      it('should not set reasoning when providerOptions has no reasoning fields', async () => {
        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            lmstudio: {},
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
                "type": "message",
              },
            ],
            "model": "gemma-7b-it",
          }
        `);
      });
    });

    describe('tool call parsing', () => {
      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('lmstudio-tool-call.1');

        result = await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather in a location',
              inputSchema: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'The location to get the weather for',
                  },
                },
                required: ['location'],
              },
            },
          ],
          toolChoice: { type: 'required' },
        });
      });

      it('should parse tool call from response', async () => {
        expect(result.content).toMatchSnapshot();
      });

      it('should return tool-calls finish reason', async () => {
        expect(result.finishReason).toStrictEqual({
          unified: 'tool-calls',
          raw: undefined,
        });
      });

      it('should extract usage correctly', async () => {
        expect(result.usage).toMatchSnapshot();
      });
    });

    describe('tool choice', () => {
      const TEST_TOOL = {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get the current weather',
        inputSchema: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
          required: ['location'],
        },
      };

      it('should send tool_choice auto', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [TEST_TOOL],
          toolChoice: { type: 'auto' },
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });

      it('should send tool_choice none', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [TEST_TOOL],
          toolChoice: { type: 'none' },
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });

      it('should send tool_choice required', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [TEST_TOOL],
          toolChoice: { type: 'required' },
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });

      it('should send tool_choice with specific tool', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: TEST_PROMPT,
          tools: [TEST_TOOL],
          toolChoice: { type: 'tool', toolName: 'get_weather' },
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });
    });

    describe('system messages', () => {
      it('should send instructions from system message', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });

      it('should join multiple system messages with newlines', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        await createModel().doGenerate({
          prompt: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            {
              role: 'system',
              content: 'Always be concise.',
            },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });
    });

    describe('multi-turn tool conversation', () => {
      it('should send correct request body with user, assistant tool-call, and tool result', async () => {
        prepareJsonFixtureResponse('lmstudio-basic.1');

        const toolConversationPrompt: LanguageModelV4Prompt = [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the weather in Tokyo?' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_weather_123',
                toolName: 'get_weather',
                input: { location: 'Tokyo' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_weather_123',
                toolName: 'get_weather',
                output: {
                  type: 'json',
                  value: { temperature: 22, condition: 'sunny', humidity: 65 },
                },
              },
            ],
          },
        ];

        await createModel().doGenerate({
          prompt: toolConversationPrompt,
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              description: 'Get the current weather for a location',
              inputSchema: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          ],
        });

        expect(await server.calls[0].requestBodyJson).toMatchSnapshot();
      });
    });

    describe('pdf input file', () => {
      function getPdfPrompt(): LanguageModelV4Prompt {
        return [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What text does this PDF contain? Reply with just the text content, nothing else.',
              },
              {
                type: 'file',
                data: {
                  type: 'url',
                  url: new globalThis.URL(
                    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                  ),
                },
                mediaType: 'application/pdf',
              },
            ],
          },
        ];
      }

      let result: LanguageModelV4GenerateResult;

      beforeEach(async () => {
        prepareJsonFixtureResponse('openai-pdf-input-file.1');

        result = await createModel('gpt-4.1-nano').doGenerate({
          prompt: getPdfPrompt(),
        });
      });

      it('should send input_file in request body', async () => {
        expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
          {
            "input": [
              {
                "content": [
                  {
                    "text": "What text does this PDF contain? Reply with just the text content, nothing else.",
                    "type": "input_text",
                  },
                  {
                    "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                    "type": "input_file",
                  },
                ],
                "role": "user",
                "type": "message",
              },
            ],
            "model": "gpt-4.1-nano",
          }
        `);
      });

      it('should produce correct content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "text": "Dummy PDF file",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract usage correctly', async () => {
        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 44,
              "total": 44,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 4,
              "total": 4,
            },
            "raw": {
              "input_tokens": 44,
              "input_tokens_details": {
                "cached_tokens": 0,
              },
              "output_tokens": 4,
              "output_tokens_details": {
                "reasoning_tokens": 0,
              },
              "total_tokens": 48,
            },
          }
        `);
      });
    });
  });

  describe('doStream', () => {
    function prepareChunksFixtureResponse(filename: string) {
      const chunks = fs
        .readFileSync(
          `src/responses/__fixtures__/${filename}.chunks.txt`,
          'utf8',
        )
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => `data: ${line}\n\n`);
      chunks.push('data: [DONE]\n\n');

      server.urls[URL].response = {
        type: 'stream-chunks',
        chunks,
      };
    }

    describe('basic generation', () => {
      it('should stream content', async () => {
        prepareChunksFixtureResponse('lmstudio-basic.1');

        const result = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    describe('reasoning with tool call', () => {
      it('should stream reasoning and tool call content', async () => {
        prepareChunksFixtureResponse('lmstudio-tool-call.2');

        const result = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        expect(
          await convertReadableStreamToArray(result.stream),
        ).toMatchSnapshot();
      });
    });

    it('should not pollute Object.prototype from tool call item ids', async () => {
      const originalArgumentsDescriptor = Object.getOwnPropertyDescriptor(
        Object.prototype,
        'arguments',
      );

      try {
        server.urls[URL].response = {
          type: 'stream-chunks',
          chunks: [
            `data: ${JSON.stringify({
              type: 'response.function_call_arguments.done',
              item_id: '__proto__',
              output_index: 0,
              arguments: 'polluted',
              sequence_number: 0,
            })}\n\n`,
            `data: ${JSON.stringify({
              type: 'response.completed',
              response: {
                incomplete_details: null,
                status: 'completed',
                usage: {
                  input_tokens: 0,
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens: 0,
                  output_tokens_details: { reasoning_tokens: 0 },
                  total_tokens: 0,
                },
              },
              sequence_number: 1,
            })}\n\n`,
            'data: [DONE]\n\n',
          ],
        };

        const result = await createModel().doStream({
          prompt: TEST_PROMPT,
        });

        await convertReadableStreamToArray(result.stream);

        expect(
          Object.getOwnPropertyDescriptor(Object.prototype, 'arguments'),
        ).toStrictEqual(originalArgumentsDescriptor);
      } finally {
        if (originalArgumentsDescriptor == null) {
          delete (Object.prototype as { arguments?: unknown }).arguments;
        } else {
          Reflect.defineProperty(
            Object.prototype,
            'arguments',
            originalArgumentsDescriptor,
          );
        }
      }
    });

    describe('pdf input file', () => {
      it('should stream content from pdf input', async () => {
        prepareChunksFixtureResponse('openai-pdf-input-file.1');

        const result = await createModel('gpt-4.1-nano').doStream({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What text does this PDF contain?',
                },
                {
                  type: 'file',
                  data: {
                    type: 'url',
                    url: new globalThis.URL(
                      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                    ),
                  },
                  mediaType: 'application/pdf',
                },
              ],
            },
          ],
        });

        expect(await convertReadableStreamToArray(result.stream))
          .toMatchInlineSnapshot(`
          [
            {
              "type": "stream-start",
              "warnings": [],
            },
            {
              "id": "msg_051ebd7ab60063870069d4fe8c1b7c8194b701e22f1ef094dd",
              "type": "text-start",
            },
            {
              "delta": "Dummy",
              "id": "msg_051ebd7ab60063870069d4fe8c1b7c8194b701e22f1ef094dd",
              "type": "text-delta",
            },
            {
              "delta": " PDF",
              "id": "msg_051ebd7ab60063870069d4fe8c1b7c8194b701e22f1ef094dd",
              "type": "text-delta",
            },
            {
              "delta": " file",
              "id": "msg_051ebd7ab60063870069d4fe8c1b7c8194b701e22f1ef094dd",
              "type": "text-delta",
            },
            {
              "id": "msg_051ebd7ab60063870069d4fe8c1b7c8194b701e22f1ef094dd",
              "type": "text-end",
            },
            {
              "finishReason": {
                "raw": undefined,
                "unified": "stop",
              },
              "providerMetadata": undefined,
              "type": "finish",
              "usage": {
                "inputTokens": {
                  "cacheRead": 0,
                  "cacheWrite": undefined,
                  "noCache": 44,
                  "total": 44,
                },
                "outputTokens": {
                  "reasoning": 0,
                  "text": 4,
                  "total": 4,
                },
                "raw": {
                  "input_tokens": 44,
                  "input_tokens_details": {
                    "cached_tokens": 0,
                  },
                  "output_tokens": 4,
                  "output_tokens_details": {
                    "reasoning_tokens": 0,
                  },
                  "total_tokens": 48,
                },
              },
            },
          ]
        `);
      });
    });
  });
});
