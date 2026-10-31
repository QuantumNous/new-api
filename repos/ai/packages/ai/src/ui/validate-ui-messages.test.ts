import { z } from 'zod/v4';
import type { InferUITool, UIMessage } from './ui-messages';
import {
  safeValidateUIMessages,
  validateUIMessages,
} from './validate-ui-messages';
import { describe, it, expect, expectTypeOf } from 'vitest';

describe('validateUIMessages', () => {
  describe('parameter validation', () => {
    it('should throw InvalidArgumentError when messages parameter is null', async () => {
      await expect(
        validateUIMessages({
          messages: null,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_InvalidArgumentError: Invalid argument for parameter messages: messages parameter must be provided]
      `);
    });

    it('should throw InvalidArgumentError when messages parameter is undefined', async () => {
      await expect(
        validateUIMessages({
          messages: undefined,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_InvalidArgumentError: Invalid argument for parameter messages: messages parameter must be provided]
      `);
    });

    it('should throw TypeValidationError when messages array is empty', async () => {
      await expect(
        validateUIMessages({
          messages: [],
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed: Value: [].
        Error message: [
          {
            "origin": "array",
            "code": "too_small",
            "minimum": 1,
            "inclusive": true,
            "path": [],
            "message": "Messages array must not be empty"
          }
        ]]
      `);
    });

    it('should throw TypeValidationError when message has empty parts array', async () => {
      await expect(
        validateUIMessages({
          messages: [
            {
              id: '1',
              role: 'user',
              parts: [],
            },
          ],
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed: Value: [{"id":"1","role":"user","parts":[]}].
        Error message: [
          {
            "origin": "array",
            "code": "too_small",
            "minimum": 1,
            "inclusive": true,
            "path": [
              0,
              "parts"
            ],
            "message": "Message must contain at least one part"
          }
        ]]
      `);
    });

    it('should validate chat ending with assistant message with empty parts array', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
          },
          {
            id: '2',
            role: 'assistant',
            parts: [],
          },
        ],
      });

      expect(messages).toEqual([
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: '2',
          role: 'assistant',
          parts: [],
        },
      ]);
    });
  });

  describe('metadata', () => {
    it('should validate a user message with metadata when no metadata schema is provided', async () => {
      type TestMessage = UIMessage<{ foo: string }>;

      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'user',
            metadata: {
              foo: 'bar',
            },
            parts: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();

      expect(messages).toMatchInlineSnapshot(`
          [
            {
              "id": "1",
              "metadata": {
                "foo": "bar",
              },
              "parts": [
                {
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ]
        `);
    });

    it('should validate a user message with metadata', async () => {
      type TestMessage = UIMessage<{ foo: string }>;

      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'user',
            metadata: {
              foo: 'bar',
            },
            parts: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
        metadataSchema: z.object({
          foo: z.string(),
        }),
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "metadata": {
              "foo": "bar",
            },
            "parts": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });

    it('should throw type validation error when metadata is invalid ', async () => {
      await expect(
        validateUIMessages<UIMessage<{ foo: string }>>({
          messages: [
            {
              id: '1',
              role: 'user',
              metadata: { foo: 123 },
              parts: [{ type: 'text', text: 'Hello, world!' }],
            },
          ],
          metadataSchema: z.object({
            foo: z.string(),
          }),
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].metadata (id: "1"): Value: {"foo":123}.
        Error message: [
          {
            "expected": "string",
            "code": "invalid_type",
            "path": [
              "foo"
            ],
            "message": "Invalid input: expected string, received number"
          }
        ]]
      `);
    });

    it('should validate text part with provider metadata', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Hello, world!',
                providerMetadata: {
                  someProvider: {
                    custom: 'metadata',
                  },
                },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "providerMetadata": {
                  "someProvider": {
                    "custom": "metadata",
                  },
                },
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('text parts', () => {
    it('should validate a user message with a text part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('custom parts', () => {
    it('should validate an assistant message with a custom part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'custom',
                kind: 'test-provider.compaction',
                providerMetadata: {
                  openai: { itemId: 'cmp_123' },
                },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "kind": "test-provider.compaction",
                "providerMetadata": {
                  "openai": {
                    "itemId": "cmp_123",
                  },
                },
                "type": "custom",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a custom part without providerMetadata', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [{ type: 'custom', kind: 'openai.compaction' }],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "kind": "openai.compaction",
                "type": "custom",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('reasoning parts', () => {
    it('should validate an assistant message with a reasoning part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [{ type: 'reasoning', text: 'Hello, world!' }],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "text": "Hello, world!",
                "type": "reasoning",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('source url parts', () => {
    it('should validate an assistant message with a source url part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'source-url',
                sourceId: '1',
                url: 'https://example.com',
                title: 'Example',
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "sourceId": "1",
                "title": "Example",
                "type": "source-url",
                "url": "https://example.com",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('source document parts', () => {
    it('should validate an assistant message with a source document part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'source-document',
                sourceId: '1',
                mediaType: 'text/plain',
                title: 'Example',
                filename: 'example.txt',
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "filename": "example.txt",
                "mediaType": "text/plain",
                "sourceId": "1",
                "title": "Example",
                "type": "source-document",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('file parts', () => {
    it('should validate an assistant message with a file part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'file',
                mediaType: 'text/plain',
                url: 'https://example.com',
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "mediaType": "text/plain",
                "type": "file",
                "url": "https://example.com",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should preserve provider references on file parts', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'user',
            parts: [
              {
                type: 'file',
                mediaType: 'text/csv',
                filename: 'sample.csv',
                url: 'data:text/csv;base64,bW9udGgscmV2ZW51ZQ==',
                providerReference: {
                  anthropic: 'file_abc123',
                },
                providerMetadata: {
                  anthropic: {
                    containerUpload: true,
                  },
                },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "filename": "sample.csv",
                "mediaType": "text/csv",
                "providerMetadata": {
                  "anthropic": {
                    "containerUpload": true,
                  },
                },
                "providerReference": {
                  "anthropic": "file_abc123",
                },
                "type": "file",
                "url": "data:text/csv;base64,bW9udGgscmV2ZW51ZQ==",
              },
            ],
            "role": "user",
          },
        ]
      `);
    });
  });

  describe('step start parts', () => {
    it('should validate an assistant message with a step start part', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [{ type: 'step-start' }],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "type": "step-start",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('data parts', () => {
    it('should validate an assistant message with two data parts', async () => {
      type TestMessage = UIMessage<
        never,
        {
          foo: { foo: string };
          bar: { bar: number };
        },
        never
      >;

      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'data-foo', data: { foo: 'bar' } },
              { type: 'data-bar', data: { bar: 123 } },
            ],
          },
        ],
        dataSchemas: {
          foo: z.object({ foo: z.string() }),
          bar: z.object({ bar: z.number() }),
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "data": {
                  "foo": "bar",
                },
                "type": "data-foo",
              },
              {
                "data": {
                  "bar": 123,
                },
                "type": "data-bar",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should throw type validation error when data is invalid', async () => {
      await expect(
        validateUIMessages<UIMessage<never, { foo: { foo: string } }>>({
          messages: [
            {
              id: '1',
              role: 'assistant',
              parts: [{ type: 'data-foo', data: { foo: 123 } }],
            },
          ],
          dataSchemas: {
            foo: z.object({ foo: z.string() }),
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].parts[0].data (foo): Value: {"foo":123}.
        Error message: [
          {
            "expected": "string",
            "code": "invalid_type",
            "path": [
              "foo"
            ],
            "message": "Invalid input: expected string, received number"
          }
        ]]
      `);
    });

    it('should throw type validation error when there is no data schema for a data part', async () => {
      await expect(
        validateUIMessages<UIMessage<never, { foo: { foo: string } }>>({
          messages: [
            {
              id: '1',
              role: 'assistant',
              parts: [{ type: 'data-bar', data: { foo: 'bar' } }],
            },
          ],
          dataSchemas: {
            foo: z.object({ foo: z.string() }),
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].parts[0].data (bar): Value: {"foo":"bar"}.
        Error message: No data schema found for data part bar]
      `);
    });
  });

  describe('dynamic tool parts', () => {
    it('should validate an assistant message with a dynamic tool part in input-streaming state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'dynamic-tool',
                toolName: 'foo',
                toolCallId: '1',
                state: 'input-streaming',
                input: { foo: 'bar' },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "state": "input-streaming",
                "toolCallId": "1",
                "toolName": "foo",
                "type": "dynamic-tool",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a dynamic tool part in input-available state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'dynamic-tool',
                toolName: 'foo',
                toolCallId: '1',
                state: 'input-available',
                input: { foo: 'bar' },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "state": "input-available",
                "toolCallId": "1",
                "toolName": "foo",
                "type": "dynamic-tool",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a dynamic tool part in output-available state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'dynamic-tool',
                toolName: 'foo',
                toolCallId: '1',
                state: 'output-available',
                input: { foo: 'bar' },
                output: { result: 'success' },
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "output": {
                  "result": "success",
                },
                "state": "output-available",
                "toolCallId": "1",
                "toolName": "foo",
                "type": "dynamic-tool",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a dynamic tool part in output-error state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'dynamic-tool',
                toolName: 'foo',
                toolCallId: '1',
                state: 'output-error',
                input: { foo: 'bar' },
                errorText: 'Tool execution failed',
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "errorText": "Tool execution failed",
                "input": {
                  "foo": "bar",
                },
                "state": "output-error",
                "toolCallId": "1",
                "toolName": "foo",
                "type": "dynamic-tool",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate a dynamic tool part in output-error state when input key is absent', async () => {
      const messages = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'foo',
              toolCallId: '1',
              state: 'output-error',
              rawInput: { foo: 'bar' },
              errorText: 'Tool execution failed',
            },
          ],
        },
      ];

      const result = await validateUIMessages({ messages });

      expectTypeOf(result).toEqualTypeOf<Array<UIMessage>>();
      expect(result).toEqual(messages);
    });
  });

  describe('tool parts', () => {
    const testTool = {
      name: 'foo',
      inputSchema: z.object({ foo: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    };

    type TestMessage = UIMessage<
      never,
      never,
      { foo: InferUITool<typeof testTool> }
    >;

    it('should validate an assistant message with a tool part in input-streaming state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'input-streaming',
                input: { foo: 'bar' },
                providerExecuted: true,
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "providerExecuted": true,
                "state": "input-streaming",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a tool part in input-available state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'input-available',
                input: { foo: 'bar' },
                providerExecuted: true,
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "providerExecuted": true,
                "state": "input-available",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a tool part in output-available state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-available',
                input: { foo: 'bar' },
                output: { result: 'success' },
                providerExecuted: true,
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "output": {
                  "result": "success",
                },
                "providerExecuted": true,
                "state": "output-available",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate an assistant message with a tool part in output-error state', async () => {
      const messages = await validateUIMessages({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-error',
                input: { foo: 'bar' },
                errorText: 'Tool execution failed',
                providerExecuted: true,
              },
            ],
          },
        ],
      });

      expectTypeOf(messages).toEqualTypeOf<Array<UIMessage>>();

      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "errorText": "Tool execution failed",
                "input": {
                  "foo": "bar",
                },
                "providerExecuted": true,
                "state": "output-error",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate tool input when state is input-available', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'input-available',
                input: { foo: 'bar' },
                providerExecuted: true,
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();
      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "providerExecuted": true,
                "state": "input-available",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate tool input and output when state is output-available', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-available',
                input: { foo: 'bar' },
                output: { result: 'success' },
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();
      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": "bar",
                },
                "output": {
                  "result": "success",
                },
                "state": "output-available",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should preserve result provider metadata when state is output-available', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-available',
                input: { foo: 'bar' },
                output: { result: 'success' },
                resultProviderMetadata: {
                  testProvider: { itemId: 'result-item' },
                },
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expect(messages[0].parts[0]).toMatchObject({
        type: 'tool-foo',
        state: 'output-available',
        resultProviderMetadata: {
          testProvider: { itemId: 'result-item' },
        },
      });
    });

    it('should not re-validate tool input when state is output-error', async () => {
      // A tool call that failed with an invalid-input error keeps its (invalid)
      // input. Re-validating it on replay would throw a TypeValidationError and
      // crash follow-up messages, so output-error input is intentionally skipped.
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-error',
                input: { foo: 123 } as unknown as { foo: string },
                errorText: 'AI_InvalidToolInputError',
                providerExecuted: false,
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();
      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "errorText": "AI_InvalidToolInputError",
                "input": {
                  "foo": 123,
                },
                "providerExecuted": false,
                "state": "output-error",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should preserve result provider metadata when state is output-error', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-error',
                input: { foo: 'bar' },
                errorText: 'Tool execution failed',
                providerExecuted: true,
                resultProviderMetadata: {
                  testProvider: { itemId: 'result-item' },
                },
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expect(messages[0].parts[0]).toMatchObject({
        type: 'tool-foo',
        state: 'output-error',
        resultProviderMetadata: {
          testProvider: { itemId: 'result-item' },
        },
      });
    });

    it('should skip tool input validation when state is output-error and there is no input', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'output-error',
                input: undefined,
                errorText: 'Tool input validation failed',
                providerExecuted: false,
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();
      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "errorText": "Tool input validation failed",
                "input": undefined,
                "providerExecuted": false,
                "state": "output-error",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should validate a tool part in output-error state when input key is absent', async () => {
      const messages = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-foo',
              toolCallId: '1',
              state: 'output-error',
              rawInput: { foo: 'bar' },
              errorText: 'Tool input validation failed',
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({ messages });

      expectTypeOf(result).toEqualTypeOf<Array<TestMessage>>();
      expect(result).toEqual(messages);
    });

    it('should preserve rawInput when state is output-error', async () => {
      const inputMessages = [
        {
          id: '1',
          role: 'assistant' as const,
          parts: [
            {
              type: 'tool-foo' as const,
              toolCallId: '1',
              state: 'output-error' as const,
              input: undefined,
              rawInput: { foo: 'bar' },
              errorText: 'Tool input validation failed',
              providerExecuted: false,
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({
        messages: inputMessages,
        tools: {
          foo: testTool,
        },
      });

      expect(result).toEqual(inputMessages);
    });

    it('should throw error when no tool schema is found', async () => {
      await expect(
        validateUIMessages<TestMessage>({
          messages: [
            {
              id: '1',
              role: 'assistant',
              parts: [
                {
                  type: 'tool-bar',
                  toolCallId: '1',
                  state: 'input-available',
                  input: { foo: 'bar' },
                  providerExecuted: true,
                },
              ],
            },
          ],
          tools: {
            foo: testTool,
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].parts[0].input (bar, id: "1"): Value: {"foo":"bar"}.
        Error message: No tool schema found for tool part bar]
      `);
    });

    it('should skip validation for tool part in output-available state when tool schema is missing', async () => {
      const inputMessages: TestMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-bar' as 'tool-foo',
              toolCallId: '1',
              state: 'output-available',
              input: { foo: 'bar' },
              output: { result: 'success' },
              providerExecuted: true,
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({
        messages: inputMessages,
        tools: {
          foo: testTool,
        },
      });

      expect(result).toEqual(inputMessages);
    });

    it('should skip validation for tool part in output-error state when tool schema is missing', async () => {
      const inputMessages: TestMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-bar' as 'tool-foo',
              toolCallId: '1',
              state: 'output-error',
              input: { foo: 'bar' },
              errorText: 'Tool execution failed',
              providerExecuted: true,
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({
        messages: inputMessages,
        tools: {
          foo: testTool,
        },
      });

      expect(result).toEqual(inputMessages);
    });

    it('should skip validation for tool part in output-denied state when tool schema is missing', async () => {
      const inputMessages: TestMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-bar' as 'tool-foo',
              toolCallId: '1',
              state: 'output-denied',
              input: { foo: 'bar' },
              approval: {
                id: 'approval-1',
                approved: false,
              },
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({
        messages: inputMessages,
        tools: {
          foo: testTool,
        },
      });

      expect(result).toEqual(inputMessages);
    });

    it('should validate automatic approval reasons on output parts', async () => {
      const inputMessages: TestMessage[] = [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-foo',
              toolCallId: '1',
              state: 'output-available',
              input: { foo: 'bar' },
              output: { result: 'ok' },
              approval: {
                id: 'approval-1',
                approved: true,
                isAutomatic: true,
                reason: 'trusted internal tool',
              },
            },
          ],
        },
      ];

      const result = await validateUIMessages<TestMessage>({
        messages: inputMessages,
        tools: {
          foo: testTool,
        },
      });

      expect(result).toEqual(inputMessages);
    });

    it('should throw error when tool input validation fails', async () => {
      await expect(
        validateUIMessages<TestMessage>({
          messages: [
            {
              id: '1',
              role: 'assistant',
              parts: [
                {
                  type: 'tool-foo',
                  toolCallId: '1',
                  state: 'input-available',
                  input: { foo: 123 }, // wrong type
                  providerExecuted: true,
                },
              ],
            },
          ],
          tools: {
            foo: testTool,
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].parts[0].input (foo, id: "1"): Value: {"foo":123}.
        Error message: [
          {
            "expected": "string",
            "code": "invalid_type",
            "path": [
              "foo"
            ],
            "message": "Invalid input: expected string, received number"
          }
        ]]
      `);
    });

    it('should throw error when tool output validation fails', async () => {
      await expect(
        validateUIMessages<TestMessage>({
          messages: [
            {
              id: '1',
              role: 'assistant',
              parts: [
                {
                  type: 'tool-foo',
                  toolCallId: '1',
                  state: 'output-available',
                  providerExecuted: true,
                  input: { foo: 'bar' },
                  output: { result: 123 }, // wrong type
                },
              ],
            },
          ],
          tools: {
            foo: testTool,
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`
        [AI_TypeValidationError: Type validation failed for messages[0].parts[0].output (foo, id: "1"): Value: {"result":123}.
        Error message: [
          {
            "expected": "string",
            "code": "invalid_type",
            "path": [
              "result"
            ],
            "message": "Invalid input: expected string, received number"
          }
        ]]
      `);
    });

    it('should not validate input in input-streaming state', async () => {
      const messages = await validateUIMessages<TestMessage>({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-foo',
                toolCallId: '1',
                state: 'input-streaming',
                input: { foo: 123 }, // wrong type but should not be validated
                providerExecuted: true,
              },
            ],
          },
        ],
        tools: {
          foo: testTool,
        },
      });

      expectTypeOf(messages).toEqualTypeOf<Array<TestMessage>>();
      expect(messages).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "parts": [
              {
                "input": {
                  "foo": 123,
                },
                "providerExecuted": true,
                "state": "input-streaming",
                "toolCallId": "1",
                "type": "tool-foo",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });
});

export function expectToBe<T extends boolean>(
  value: boolean,
  expected: T,
): asserts value is T {
  expect(value).toBe(expected);
}

describe('safeValidateUIMessages', () => {
  it('should return success result for valid messages', async () => {
    const result = await safeValidateUIMessages({
      messages: [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello, world!' }],
        },
      ],
    });

    expectToBe(result.success, true);
    expect(result.data).toMatchInlineSnapshot(`
      [
        {
          "id": "1",
          "parts": [
            {
              "text": "Hello, world!",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should return failure result when messages parameter is null', async () => {
    const result = await safeValidateUIMessages({
      messages: null,
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_InvalidArgumentError');
    expect(result.error.message).toBe(
      'Invalid argument for parameter messages: messages parameter must be provided',
    );
  });

  it('should return failure result when messages array is empty', async () => {
    const result = await safeValidateUIMessages({
      messages: [],
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
    expect(result.error.message).toContain('Type validation failed');
    expect(result.error.message).toContain('Messages array must not be empty');
  });

  it('should return failure result when message has empty parts array', async () => {
    const result = await safeValidateUIMessages({
      messages: [
        {
          id: '1',
          role: 'user',
          parts: [],
        },
      ],
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
    expect(result.error.message).toContain('Type validation failed');
  });

  it('should return success result for chat ending with assistant message with empty parts array', async () => {
    const result = await safeValidateUIMessages({
      messages: [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: '2',
          role: 'assistant',
          parts: [],
        },
      ],
    });

    expectToBe(result.success, true);
    expect(result.data).toEqual([
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      {
        id: '2',
        role: 'assistant',
        parts: [],
      },
    ]);
  });

  it('should return failure result when metadata validation fails', async () => {
    const result = await safeValidateUIMessages<UIMessage<{ foo: string }>>({
      messages: [
        {
          id: '1',
          role: 'user',
          metadata: { foo: 123 },
          parts: [{ type: 'text', text: 'Hello, world!' }],
        },
      ],
      metadataSchema: z.object({ foo: z.string() }),
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
    expect(result.error.message).toContain('Type validation failed');
  });

  it('should return failure result when tool input validation fails', async () => {
    const testTool = {
      name: 'foo',
      inputSchema: z.object({ foo: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    };

    const result = await safeValidateUIMessages({
      messages: [
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-foo',
              toolCallId: '1',
              state: 'input-available',
              input: { foo: 123 },
              providerExecuted: true,
            },
          ],
        },
      ],
      tools: { foo: testTool },
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
    expect(result.error.message).toContain('Type validation failed');
  });

  it('should return failure result when data schema is missing', async () => {
    const result = await safeValidateUIMessages({
      messages: [
        {
          id: '1',
          role: 'assistant',
          parts: [{ type: 'data-bar', data: { foo: 'bar' } }],
        },
      ],
      dataSchemas: {
        foo: z.object({ foo: z.string() }),
      },
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
    expect(result.error.message).toContain(
      'No data schema found for data part bar',
    );
  });

  it('should return failure result for invalid message structure', async () => {
    const result = await safeValidateUIMessages({
      messages: [
        {
          role: 'user',
        },
      ],
    });

    expectToBe(result.success, false);
    expect(result.error.name).toBe('AI_TypeValidationError');
  });
});
