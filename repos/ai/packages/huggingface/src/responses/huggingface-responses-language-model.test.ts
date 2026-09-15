import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { HuggingFaceResponsesLanguageModel } from './huggingface-responses-language-model';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

function createModel(modelId: string) {
  return new HuggingFaceResponsesLanguageModel(modelId, {
    provider: 'huggingface.responses',
    url: ({ path }) => `https://router.huggingface.co/v1${path}`,
    headers: () => ({ Authorization: `Bearer APIKEY` }),
    generateId: mockId(),
  });
}

describe('HuggingFaceResponsesLanguageModel', () => {
  const server = createTestServer({
    'https://router.huggingface.co/v1/responses': {},
  });

  describe('doGenerate', () => {
    describe('basic text response', () => {
      beforeEach(() => {
        server.urls['https://router.huggingface.co/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_67c97c0203188190a025beb4a75242bc',
            model: 'deepseek-ai/DeepSeek-V3-0324',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            instructions: null,
            max_output_tokens: null,
            metadata: null,
            tool_choice: 'auto',
            tools: [],
            temperature: 1.0,
            top_p: 1.0,
            incomplete_details: null,
            usage: {
              input_tokens: 12,
              output_tokens: 25,
              total_tokens: 37,
            },
            output: [
              {
                id: 'msg_67c97c02656c81908e080dfdf4a03cd1',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text: 'Hello! How can I help you today?',
                  },
                ],
              },
            ],
            output_text: 'Hello! How can I help you today?',
          },
        };
      });

      it('should generate text', async () => {
        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "huggingface": {
                  "itemId": "msg_67c97c02656c81908e080dfdf4a03cd1",
                },
              },
              "text": "Hello! How can I help you today?",
              "type": "text",
            },
          ]
        `);
      });

      it('should extract usage', async () => {
        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 12,
              "total": 12,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 25,
              "total": 25,
            },
            "raw": {
              "input_tokens": 12,
              "output_tokens": 25,
              "total_tokens": 37,
            },
          }
        `);
      });

      it('should extract text from output array when output_text is missing', async () => {
        server.urls['https://router.huggingface.co/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_test',
            model: 'deepseek-ai/DeepSeek-V3-0324',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            instructions: null,
            max_output_tokens: null,
            metadata: null,
            tool_choice: 'auto',
            tools: [],
            temperature: 1.0,
            top_p: 1.0,
            incomplete_details: null,
            usage: null,
            output: [
              {
                id: 'msg_test',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text: 'Extracted from output array',
                  },
                ],
              },
            ],
            output_text: null,
          },
        };

        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "huggingface": {
                  "itemId": "msg_test",
                },
              },
              "text": "Extracted from output array",
              "type": "text",
            },
          ]
        `);
      });

      it('should handle missing usage gracefully', async () => {
        server.urls['https://router.huggingface.co/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_test',
            model: 'deepseek-ai/DeepSeek-V3-0324',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            instructions: null,
            max_output_tokens: null,
            metadata: null,
            tool_choice: 'auto',
            tools: [],
            temperature: 1.0,
            top_p: 1.0,
            incomplete_details: null,
            usage: null,
            output: [],
            output_text: 'Test response',
          },
        };

        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.usage).toMatchInlineSnapshot(`
          {
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
          }
        `);
      });

      it('should send model id, settings, and input', async () => {
        await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
          prompt: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
          temperature: 0.5,
          topP: 0.3,
          maxOutputTokens: 100,
        });

        expect(await server.calls[0].requestBodyJson).toStrictEqual({
          model: 'deepseek-ai/DeepSeek-V3-0324',
          temperature: 0.5,
          top_p: 0.3,
          max_output_tokens: 100,
          stream: false,
          input: [
            { role: 'system', content: 'You are a helpful assistant.' },
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello' }],
            },
          ],
        });
      });

      it('should handle unsupported settings with warnings', async () => {
        const { warnings } = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
          topK: 10,
          seed: 123,
          presencePenalty: 0.5,
          frequencyPenalty: 0.3,
          stopSequences: ['stop'],
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

      it('should generate text and sources from annotations', async () => {
        server.urls['https://router.huggingface.co/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_test_annotations',
            model: 'deepseek-ai/DeepSeek-V3-0324',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            instructions: null,
            max_output_tokens: null,
            metadata: null,
            tool_choice: 'auto',
            tools: [],
            temperature: 1.0,
            top_p: 1.0,
            incomplete_details: null,
            usage: {
              input_tokens: 20,
              output_tokens: 50,
              total_tokens: 70,
            },
            output: [
              {
                id: 'msg_test_annotations',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text: 'Here are some recent articles about AI: The first article discusses new developments ([example.com](https://example.com/article1)). Another piece covers industry trends ([test.com](https://test.com/article2)).',
                    annotations: [
                      {
                        type: 'url_citation',
                        url: 'https://example.com/article1',
                        title: 'AI Developments Article',
                      },
                      {
                        type: 'url_citation',
                        url: 'https://test.com/article2',
                        title: 'Industry Trends Report',
                      },
                    ],
                  },
                ],
              },
            ],
            output_text: null,
          },
        };

        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": {
                "huggingface": {
                  "itemId": "msg_test_annotations",
                },
              },
              "text": "Here are some recent articles about AI: The first article discusses new developments ([example.com](https://example.com/article1)). Another piece covers industry trends ([test.com](https://test.com/article2)).",
              "type": "text",
            },
            {
              "id": "id-0",
              "sourceType": "url",
              "title": "AI Developments Article",
              "type": "source",
              "url": "https://example.com/article1",
            },
            {
              "id": "id-1",
              "sourceType": "url",
              "title": "Industry Trends Report",
              "type": "source",
              "url": "https://test.com/article2",
            },
          ]
        `);
      });

      it('should handle MCP tools with annotations', async () => {
        server.urls['https://router.huggingface.co/v1/responses'].response = {
          type: 'json-value',
          body: {
            id: 'resp_mcp_test',
            model: 'deepseek-ai/DeepSeek-V3-0324',
            object: 'response',
            created_at: 1741257730,
            status: 'completed',
            error: null,
            instructions: null,
            max_output_tokens: null,
            metadata: null,
            tool_choice: 'auto',
            tools: [],
            temperature: 1.0,
            top_p: 1.0,
            incomplete_details: null,
            usage: {
              input_tokens: 50,
              output_tokens: 100,
              total_tokens: 150,
            },
            output: [
              {
                id: 'mcp_search_test',
                type: 'mcp_call',
                server_label: 'web_search',
                name: 'search',
                arguments: '{"query": "San Francisco tech events"}',
                output: 'Found 25 tech events in San Francisco',
              },
              {
                id: 'msg_mcp_response',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text: 'Based on the search results, here are the latest tech events in San Francisco: There are several AI conferences ([techevents.com](https://techevents.com/sf-ai)) and startup meetups ([eventbrite.com](https://eventbrite.com/sf-startups)) happening this week.',
                    annotations: [
                      {
                        type: 'url_citation',
                        url: 'https://techevents.com/sf-ai',
                        title: 'SF AI Conference 2025',
                      },
                      {
                        type: 'url_citation',
                        url: 'https://eventbrite.com/sf-startups',
                        title: 'SF Startup Meetups',
                      },
                    ],
                  },
                ],
              },
            ],
            output_text: null,
          },
        };

        const result = await createModel(
          'deepseek-ai/DeepSeek-V3-0324',
        ).doGenerate({
          prompt: TEST_PROMPT,
        });

        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": "{"query": "San Francisco tech events"}",
              "providerExecuted": true,
              "toolCallId": "mcp_search_test",
              "toolName": "search",
              "type": "tool-call",
            },
            {
              "result": "Found 25 tech events in San Francisco",
              "toolCallId": "mcp_search_test",
              "toolName": "search",
              "type": "tool-result",
            },
            {
              "providerMetadata": {
                "huggingface": {
                  "itemId": "msg_mcp_response",
                },
              },
              "text": "Based on the search results, here are the latest tech events in San Francisco: There are several AI conferences ([techevents.com](https://techevents.com/sf-ai)) and startup meetups ([eventbrite.com](https://eventbrite.com/sf-startups)) happening this week.",
              "type": "text",
            },
            {
              "id": "id-0",
              "sourceType": "url",
              "title": "SF AI Conference 2025",
              "type": "source",
              "url": "https://techevents.com/sf-ai",
            },
            {
              "id": "id-1",
              "sourceType": "url",
              "title": "SF Startup Meetups",
              "type": "source",
              "url": "https://eventbrite.com/sf-startups",
            },
          ]
        `);
      });
    });
  });

  describe('doStream', () => {
    it('should stream text deltas', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_test","object":"response","created_at":1741269019,"status":"in_progress","model":"deepseek-ai/DeepSeek-V3-0324"}}\n\n`,
          `data:{"type":"response.in_progress","response":{"id":"resp_test","object":"response","created_at":1741269019,"status":"in_progress"}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_test","type":"message","role":"assistant","status":"in_progress","content":[]},"sequence_number":1}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_test","output_index":0,"content_index":0,"delta":"Hello,","sequence_number":2}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_test","output_index":0,"content_index":0,"delta":" World!","sequence_number":3}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_test","type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"Hello, World!"}]},"sequence_number":4}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_test","model":"deepseek-ai/DeepSeek-V3-0324","object":"response","created_at":1741269112,"status":"completed","incomplete_details":null,"usage":{"input_tokens":12,"output_tokens":25,"total_tokens":37},"output":[{"id":"msg_test","type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"Hello, World!"}]}]},"sequence_number":5}\n\n`,
        ],
      };

      const { stream } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doStream({
        prompt: TEST_PROMPT,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "resp_test",
            "modelId": "deepseek-ai/DeepSeek-V3-0324",
            "timestamp": 2025-03-06T13:50:19.000Z,
            "type": "response-metadata",
          },
          {
            "id": "msg_test",
            "providerMetadata": {
              "huggingface": {
                "itemId": "msg_test",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "Hello,",
            "id": "msg_test",
            "type": "text-delta",
          },
          {
            "delta": " World!",
            "id": "msg_test",
            "type": "text-delta",
          },
          {
            "id": "msg_test",
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "huggingface": {
                "responseId": "resp_test",
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
                "text": 25,
                "total": 25,
              },
              "raw": {
                "input_tokens": 12,
                "output_tokens": 25,
                "total_tokens": 37,
              },
            },
          },
        ]
      `);
    });

    it('should handle streaming without usage', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_test","type":"message","role":"assistant","status":"in_progress"},"sequence_number":1}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_test","output_index":0,"content_index":0,"delta":"Hi!","sequence_number":2}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"msg_test","type":"message","role":"assistant","status":"completed"},"sequence_number":3}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_test","status":"completed","incomplete_details":null,"usage":null},"sequence_number":4}\n\n`,
        ],
      };

      const { stream } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doStream({
        prompt: TEST_PROMPT,
      });

      const chunks = await convertReadableStreamToArray(stream);
      const finishChunk = chunks.find(chunk => chunk.type === 'finish');

      expect(finishChunk?.usage).toMatchInlineSnapshot(`
        {
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
        }
      `);
    });

    it('should handle non-message item types', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"mcp_test","type":"mcp_list_tools","server_label":"test"},"sequence_number":1}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"mcp_test","type":"mcp_list_tools","server_label":"test"},"sequence_number":2}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_test","status":"completed","incomplete_details":null},"sequence_number":3}\n\n`,
        ],
      };

      const { stream } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doStream({
        prompt: TEST_PROMPT,
      });

      const chunks = await convertReadableStreamToArray(stream);

      // Should only have stream-start and finish events (no text events for non-message items)
      expect(chunks.map(chunk => chunk.type)).toEqual([
        'stream-start',
        'finish',
      ]);
    });

    it('should handle streaming errors', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"msg_test","type":"message","role":"assistant"},"sequence_number":1}\n\n`,
          `data:invalid json}\n\n`, // malformed JSON that will cause parsing error
        ],
      };

      const { stream } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doStream({
        prompt: TEST_PROMPT,
      });

      const chunks = await convertReadableStreamToArray(stream);
      const errorChunk = chunks.find(chunk => chunk.type === 'error');
      const finishChunk = chunks.find(chunk => chunk.type === 'finish');

      expect(errorChunk).toBeDefined();
      expect(errorChunk?.type).toBe('error');
      expect(finishChunk?.finishReason).toMatchInlineSnapshot(`
        {
          "raw": undefined,
          "unified": "error",
        }
      `);
    });

    it('should send correct streaming request', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.completed","response":{"id":"resp_test","status":"completed"},"sequence_number":1}\n\n`,
        ],
      };

      await createModel('deepseek-ai/DeepSeek-V3-0324').doStream({
        prompt: TEST_PROMPT,
        temperature: 0.7,
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model: 'deepseek-ai/DeepSeek-V3-0324',
        temperature: 0.7,
        stream: true,
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: 'Hello' }],
          },
        ],
      });
    });
  });

  describe('message conversion', () => {
    beforeEach(() => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_test',
          model: 'moonshotai/Kimi-K2-Instruct',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [],
          output_text: 'Test response',
        },
      };
    });

    it('should convert user messages with images', async () => {
      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do you see?' },
              {
                type: 'file',
                mediaType: 'image/jpeg',
                data: { type: 'data' as const, data: 'AQIDBA==' },
              },
            ],
          },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.input[0].content).toMatchInlineSnapshot(`
        [
          {
            "text": "What do you see?",
            "type": "input_text",
          },
          {
            "image_url": "data:image/jpeg;base64,AQIDBA==",
            "type": "input_image",
          },
        ]
      `);
    });

    it('should throw for file parts with provider references', async () => {
      await expect(
        createModel('Qwen/Qwen2.5-VL-32B-Instruct').doGenerate({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'image/jpeg',
                  data: {
                    type: 'reference' as const,
                    reference: { huggingface: 'file-ref-123' },
                  },
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow(
        "'file parts with provider references' functionality not supported",
      );
    });

    it('should handle assistant messages', async () => {
      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
          { role: 'user', content: [{ type: 'text', text: 'How are you?' }] },
        ],
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "Hello",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "text": "Hi there!",
                "type": "output_text",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "text": "How are you?",
                "type": "input_text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should warn about unsupported assistant content types', async () => {
      const { warnings } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doGenerate({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'test',
                toolName: 'test',
                input: {},
              },
              {
                type: 'tool-result',
                toolCallId: 'test',
                toolName: 'test',
                output: { type: 'text', value: 'test' },
              },
              { type: 'reasoning', text: 'thinking...' },
            ],
          },
        ],
      });

      expect(warnings).toMatchInlineSnapshot(`[]`);
    });

    it('should warn about tool messages', async () => {
      const { warnings } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doGenerate({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'test',
                toolName: 'test',
                output: { type: 'text', value: 'test' },
              },
            ],
          },
        ],
      });

      expect(warnings).toMatchInlineSnapshot(`
        [
          {
            "feature": "tool messages",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  describe('tool calls', () => {
    it('should handle function_call tool responses', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_tool_test',
          model: 'deepseek-ai/DeepSeek-V3-0324',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: {
            input_tokens: 50,
            output_tokens: 30,
            total_tokens: 80,
          },
          output: [
            {
              id: 'fc_test',
              type: 'function_call',
              call_id: 'call_123',
              name: 'getWeather',
              arguments: '{"location": "New York"}',
              output: '{"temperature": "72°F", "condition": "sunny"}',
            },
            {
              id: 'msg_after_tool',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'The weather in New York is 72°F and sunny.',
                },
              ],
            },
          ],
          output_text: null,
        },
      };

      const result = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"location": "New York"}",
            "toolCallId": "call_123",
            "toolName": "getWeather",
            "type": "tool-call",
          },
          {
            "result": "{"temperature": "72°F", "condition": "sunny"}",
            "toolCallId": "call_123",
            "toolName": "getWeather",
            "type": "tool-result",
          },
          {
            "providerMetadata": {
              "huggingface": {
                "itemId": "msg_after_tool",
              },
            },
            "text": "The weather in New York is 72°F and sunny.",
            "type": "text",
          },
        ]
      `);
    });

    it('should stream tool calls', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_tool_stream","object":"response","created_at":1741269019,"status":"in_progress","model":"deepseek-ai/DeepSeek-V3-0324"}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"fc_stream","type":"function_call","call_id":"call_456","name":"calculator","arguments":""},"sequence_number":1}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_stream","output_index":0,"delta":"{\\"operation\\"","sequence_number":2}\n\n`,
          `data:{"type":"response.function_call_arguments.delta","item_id":"fc_stream","output_index":0,"delta":": \\"add\\", \\"a\\": 5, \\"b\\": 3}","sequence_number":3}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"fc_stream","type":"function_call","call_id":"call_456","name":"calculator","arguments":"{\\"operation\\": \\"add\\", \\"a\\": 5, \\"b\\": 3}","output":"8"},"sequence_number":4}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_tool_stream","status":"completed","usage":{"input_tokens":20,"output_tokens":15,"total_tokens":35}},"sequence_number":5}\n\n`,
        ],
      };

      const { stream } = await createModel(
        'deepseek-ai/DeepSeek-V3-0324',
      ).doStream({
        prompt: TEST_PROMPT,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "resp_tool_stream",
            "modelId": "deepseek-ai/DeepSeek-V3-0324",
            "timestamp": 2025-03-06T13:50:19.000Z,
            "type": "response-metadata",
          },
          {
            "id": "call_456",
            "toolName": "calculator",
            "type": "tool-input-start",
          },
          {
            "id": "call_456",
            "type": "tool-input-end",
          },
          {
            "input": "{"operation": "add", "a": 5, "b": 3}",
            "toolCallId": "call_456",
            "toolName": "calculator",
            "type": "tool-call",
          },
          {
            "result": "8",
            "toolCallId": "call_456",
            "toolName": "calculator",
            "type": "tool-result",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "huggingface": {
                "responseId": "resp_tool_stream",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 20,
                "total": 20,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 15,
                "total": 15,
              },
              "raw": {
                "input_tokens": 20,
                "output_tokens": 15,
                "total_tokens": 35,
              },
            },
          },
        ]
      `);
    });
  });

  describe('structured output', () => {
    it('should send text.format for structured output', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_structured',
          model: 'moonshotai/Kimi-K2-Instruct',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [
            {
              id: 'msg_structured',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: '{"name": "John Doe", "age": 30}',
                },
              ],
            },
          ],
          output_text: null,
        },
      };

      await createModel('moonshotai/Kimi-K2-Instruct').doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name', 'age'],
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.text).toMatchInlineSnapshot(`
        {
          "format": {
            "name": "response",
            "schema": {
              "properties": {
                "age": {
                  "type": "number",
                },
                "name": {
                  "type": "string",
                },
              },
              "required": [
                "name",
                "age",
              ],
              "type": "object",
            },
            "strict": false,
            "type": "json_schema",
          },
        }
      `);
    });

    it('should handle structured output with custom name and description', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_structured',
          model: 'moonshotai/Kimi-K2-Instruct',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [],
          output_text: '{}',
        },
      };

      await createModel('moonshotai/Kimi-K2-Instruct').doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          name: 'person_profile',
          description: 'A person profile with basic information',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.text?.format?.name).toBe('person_profile');
      expect(requestBody.text?.format?.description).toBe(
        'A person profile with basic information',
      );
    });
  });

  describe('reasoning', () => {
    it('should handle reasoning content in responses', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_reasoning',
          model: 'deepseek-ai/DeepSeek-R1',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: {
            input_tokens: 10,
            output_tokens: 50,
            total_tokens: 60,
          },
          output: [
            {
              id: 'reasoning_1',
              type: 'reasoning',
              content: [
                {
                  type: 'reasoning_text',
                  text: 'Let me think about this problem step by step...',
                },
              ],
            },
            {
              id: 'msg_after_reasoning',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'The answer is 42.',
                },
              ],
            },
          ],
          output_text: null,
        },
      };

      const result = await createModel('deepseek-ai/DeepSeek-R1').doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "huggingface": {
                "itemId": "reasoning_1",
              },
            },
            "text": "Let me think about this problem step by step...",
            "type": "reasoning",
          },
          {
            "providerMetadata": {
              "huggingface": {
                "itemId": "msg_after_reasoning",
              },
            },
            "text": "The answer is 42.",
            "type": "text",
          },
        ]
      `);
    });

    it('should stream reasoning content', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'stream-chunks',
        chunks: [
          `data:{"type":"response.created","response":{"id":"resp_reasoning_stream","object":"response","created_at":1741269019,"status":"in_progress","model":"deepseek-ai/DeepSeek-R1"}}\n\n`,
          `data:{"type":"response.output_item.added","output_index":0,"item":{"id":"reasoning_stream","type":"reasoning"},"sequence_number":1}\n\n`,
          `data:{"type":"response.reasoning_text.delta","item_id":"reasoning_stream","output_index":0,"content_index":0,"delta":"Thinking about","sequence_number":2}\n\n`,
          `data:{"type":"response.reasoning_text.delta","item_id":"reasoning_stream","output_index":0,"content_index":0,"delta":" the problem...","sequence_number":3}\n\n`,
          `data:{"type":"response.reasoning_text.done","item_id":"reasoning_stream","output_index":0,"content_index":0,"text":"Thinking about the problem...","sequence_number":4}\n\n`,
          `data:{"type":"response.output_item.done","output_index":0,"item":{"id":"reasoning_stream","type":"reasoning","content":[{"type":"reasoning_text","text":"Thinking about the problem..."}]},"sequence_number":5}\n\n`,
          `data:{"type":"response.output_item.added","output_index":1,"item":{"id":"msg_stream","type":"message","role":"assistant"},"sequence_number":6}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_stream","output_index":1,"content_index":0,"delta":"The solution is","sequence_number":7}\n\n`,
          `data:{"type":"response.output_text.delta","item_id":"msg_stream","output_index":1,"content_index":0,"delta":" simple.","sequence_number":8}\n\n`,
          `data:{"type":"response.output_item.done","output_index":1,"item":{"id":"msg_stream","type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"The solution is simple."}]},"sequence_number":9}\n\n`,
          `data:{"type":"response.completed","response":{"id":"resp_reasoning_stream","status":"completed","usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}},"sequence_number":10}\n\n`,
        ],
      };

      const { stream } = await createModel('deepseek-ai/DeepSeek-R1').doStream({
        prompt: TEST_PROMPT,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "resp_reasoning_stream",
            "modelId": "deepseek-ai/DeepSeek-R1",
            "timestamp": 2025-03-06T13:50:19.000Z,
            "type": "response-metadata",
          },
          {
            "id": "reasoning_stream",
            "providerMetadata": {
              "huggingface": {
                "itemId": "reasoning_stream",
              },
            },
            "type": "reasoning-start",
          },
          {
            "delta": "Thinking about",
            "id": "reasoning_stream",
            "type": "reasoning-delta",
          },
          {
            "delta": " the problem...",
            "id": "reasoning_stream",
            "type": "reasoning-delta",
          },
          {
            "id": "reasoning_stream",
            "type": "reasoning-end",
          },
          {
            "id": "msg_stream",
            "providerMetadata": {
              "huggingface": {
                "itemId": "msg_stream",
              },
            },
            "type": "text-start",
          },
          {
            "delta": "The solution is",
            "id": "msg_stream",
            "type": "text-delta",
          },
          {
            "delta": " simple.",
            "id": "msg_stream",
            "type": "text-delta",
          },
          {
            "id": "msg_stream",
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": undefined,
              "unified": "stop",
            },
            "providerMetadata": {
              "huggingface": {
                "responseId": "resp_reasoning_stream",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 10,
                "total": 10,
              },
              "outputTokens": {
                "reasoning": 0,
                "text": 20,
                "total": 20,
              },
              "raw": {
                "input_tokens": 10,
                "output_tokens": 20,
                "total_tokens": 30,
              },
            },
          },
        ]
      `);
    });
  });

  describe('provider options', () => {
    it('should send provider-specific options', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_provider_options',
          model: 'deepseek-ai/DeepSeek-V3-0324',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [],
          output_text: 'Test',
        },
      };

      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          huggingface: {
            metadata: { key: 'value' },
            instructions: 'Be concise',
            strictJsonSchema: true,
          },
        },
        responseFormat: {
          type: 'json',
          schema: { type: 'object' },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.metadata).toMatchInlineSnapshot(`
        {
          "key": "value",
        }
      `);
      expect(requestBody.instructions).toBe('Be concise');
      expect(requestBody.text?.format?.strict).toBe(true);
    });
  });

  describe('tool preparation', () => {
    it('should prepare tools correctly', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_tools',
          model: 'deepseek-ai/DeepSeek-V3-0324',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [],
          output_text: 'Test',
        },
      };

      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'getWeather',
            description: 'Get weather information',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        ],
        toolChoice: {
          type: 'tool',
          toolName: 'getWeather',
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "Get weather information",
            "name": "getWeather",
            "parameters": {
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
            "type": "function",
          },
        ]
      `);
      expect(requestBody.tool_choice).toMatchInlineSnapshot(`
        {
          "function": {
            "name": "getWeather",
          },
          "type": "function",
        }
      `);
    });

    it('should handle auto and required tool choices', async () => {
      server.urls['https://router.huggingface.co/v1/responses'].response = {
        type: 'json-value',
        body: {
          id: 'resp_tools',
          model: 'deepseek-ai/DeepSeek-V3-0324',
          object: 'response',
          created_at: 1741257730,
          status: 'completed',
          error: null,
          instructions: null,
          max_output_tokens: null,
          metadata: null,
          tool_choice: 'auto',
          tools: [],
          temperature: 1.0,
          top_p: 1.0,
          incomplete_details: null,
          usage: null,
          output: [],
          output_text: 'Test',
        },
      };

      // Test auto
      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'test',
            inputSchema: { type: 'object' },
          },
        ],
        toolChoice: { type: 'auto' },
      });

      let requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.tool_choice).toBe('auto');

      // Test required
      await createModel('deepseek-ai/DeepSeek-V3-0324').doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'function',
            name: 'test',
            inputSchema: { type: 'object' },
          },
        ],
        toolChoice: { type: 'required' },
      });

      requestBody = await server.calls[1].requestBodyJson;
      expect(requestBody.tool_choice).toBe('required');
    });
  });

  describe('top-level-only media type resolution', () => {
    const pngBase64 = 'iVBORw0KGgo=';

    it('passes full image/png through unchanged for inline data', async () => {
      const { convertToHuggingFaceResponsesMessages } =
        await import('./convert-to-huggingface-responses-messages');
      const result = await convertToHuggingFaceResponsesMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect(((result.input as any[])[0].content as unknown[])[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });

    it('detects image subtype from inline bytes for top-level "image"', async () => {
      const { convertToHuggingFaceResponsesMessages } =
        await import('./convert-to-huggingface-responses-messages');
      const result = await convertToHuggingFaceResponsesMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect(((result.input as any[])[0].content as unknown[])[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });

    it('passes through URL source for top-level-only image', async () => {
      const { convertToHuggingFaceResponsesMessages } =
        await import('./convert-to-huggingface-responses-messages');
      const result = await convertToHuggingFaceResponsesMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: {
                  type: 'url',
                  url: new URL('https://example.com/x.png'),
                },
              },
            ],
          },
        ],
      });

      expect(((result.input as any[])[0].content as unknown[])[0]).toEqual({
        type: 'input_image',
        image_url: 'https://example.com/x.png',
      });
    });

    it('normalizes image/* wildcard via detection', async () => {
      const { convertToHuggingFaceResponsesMessages } =
        await import('./convert-to-huggingface-responses-messages');
      const result = await convertToHuggingFaceResponsesMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/*',
                data: { type: 'data', data: pngBase64 },
              },
            ],
          },
        ],
      });

      expect(((result.input as any[])[0].content as unknown[])[0]).toEqual({
        type: 'input_image',
        image_url: `data:image/png;base64,${pngBase64}`,
      });
    });
  });
});
