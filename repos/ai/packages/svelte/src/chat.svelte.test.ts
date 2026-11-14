import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { mockId } from '@ai-sdk/provider-utils/test';
import {
  DefaultChatTransport,
  isStaticToolUIPart,
  TextStreamChatTransport,
  type UIMessageChunk,
} from 'ai';
import { flushSync } from 'svelte';
import { Chat } from './chat.svelte.js';
import { promiseWithResolvers } from './utils.svelte.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function formatChunk(part: UIMessageChunk) {
  return `data: ${JSON.stringify(part)}\n\n`;
}

function createFileList(...files: File[]): FileList {
  // file lists are really hard to create :(
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('name', 'file-upload');
  input.multiple = true;
  const fileList: FileList = Object.create(input.files);
  for (let i = 0; i < files.length; i++) {
    fileList[i] = files[i];
  }
  Object.defineProperty(fileList, 'length', { value: files.length });
  return fileList;
}

const server = createTestServer({
  '/api/chat': {},
});

describe('data protocol stream', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should correctly manage streamed response in messages', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
      ],
    };

    await chat.sendMessage({
      parts: [{ text: 'hi', type: 'text' }],
    });
    expect(chat.messages.at(0)).toEqual(
      expect.objectContaining({
        role: 'user',
        parts: [{ text: 'hi', type: 'text' }],
      }),
    );

    expect(chat.messages.at(1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello, world.', state: 'done' }],
      }),
    );
  });

  it('should show error response when there is a server error', async () => {
    server.urls['/api/chat'].response = {
      type: 'error',
      status: 404,
      body: 'Not found',
    };

    await chat.sendMessage({
      text: 'hi',
    });
    expect(chat.error).toBeInstanceOf(Error);
    expect(chat.error?.message).toBe('Not found');
  });

  it('should show error response when there is a streaming error', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'error',
          errorText: 'custom error message',
        }),
      ],
    };

    await chat.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });
    expect(chat.error).toBeInstanceOf(Error);
    expect(chat.error?.message).toBe('custom error message');
  });

  describe('status', () => {
    it('should show status', async () => {
      const controller = new TestResponseController();
      server.urls['/api/chat'].response = {
        type: 'controlled-stream',
        controller,
      };

      const appendOperation = chat.sendMessage({
        role: 'user',
        parts: [{ text: 'hi', type: 'text' }],
      });
      await vi.waitFor(() => expect(chat.status).toBe('submitted'));
      controller.write(formatChunk({ type: 'text-start', id: '0' }));
      controller.write(
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
      );
      controller.write(formatChunk({ type: 'text-end', id: '0' }));
      await vi.waitFor(() => expect(chat.status).toBe('streaming'));
      controller.close();
      await appendOperation;
      expect(chat.status).toBe('ready');
    });

    it('should set status to error when there is a server error', async () => {
      server.urls['/api/chat'].response = {
        type: 'error',
        status: 404,
        body: 'Not found',
      };

      chat.sendMessage({
        role: 'user',
        parts: [{ text: 'hi', type: 'text' }],
      });
      await vi.waitFor(() => expect(chat.status).toBe('error'));
    });
  });

  it('should invoke onFinish when the stream finishes', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
        formatChunk({
          type: 'finish',
          messageMetadata: {
            example: 'metadata',
          },
        }),
      ],
    };

    const onFinish = vi.fn();
    const chatWithOnFinish = new Chat({
      onFinish,
      generateId: mockId(),
    });
    await chatWithOnFinish.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      isAbort: false,
      isDisconnect: false,
      isError: false,
      message: {
        id: 'id-2',
        metadata: {
          example: 'metadata',
        },
        parts: [
          {
            text: 'Hello, world.',
            type: 'text',
            state: 'done',
          },
        ],
        role: 'assistant',
      },
      messages: [
        {
          id: 'id-1',
          metadata: undefined,
          parts: [
            {
              text: 'hi',
              type: 'text',
            },
          ],
          role: 'user',
        },
        {
          id: 'id-2',
          metadata: {
            example: 'metadata',
          },
          parts: [
            {
              text: 'Hello, world.',
              type: 'text',
              state: 'done',
            },
          ],
          role: 'assistant',
        },
      ],
    });
  });

  describe('id', () => {
    it('should send the id to the server', async () => {
      server.urls['/api/chat'].response = {
        type: 'stream-chunks',
        chunks: ['0:"Hello"\n', '0:","\n', '0:" world"\n', '0:"."\n'],
      };

      await chat.sendMessage({
        role: 'user',
        parts: [{ text: 'hi', type: 'text' }],
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "id": "id-0",
          "messages": [
            {
              "id": "id-1",
              "parts": [
                {
                  "text": "hi",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ],
          "trigger": "submit-message",
        }
      `);
    });
  });
});

describe('text stream', () => {
  let chat: Chat;

  beforeEach(() => {
    const generateId = mockId();

    chat = new Chat({
      generateId,
      transport: new TextStreamChatTransport({
        api: '/api/chat',
      }),
    });
  });

  it('should show streamed response', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: ['Hello', ',', ' world', '.'],
    };

    await chat.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(chat.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "id-1",
          "metadata": undefined,
          "parts": [
            {
              "text": "hi",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "id": "id-2",
          "metadata": undefined,
          "parts": [
            {
              "type": "step-start",
            },
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Hello, world.",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should have stable message ids', async () => {
    const controller = new TestResponseController();
    server.urls['/api/chat'].response = {
      type: 'controlled-stream',
      controller,
    };

    const appendOperation = chat.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });
    controller.write('He');

    await vi.waitFor(() =>
      expect(chat.messages.at(1)).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          role: 'assistant',
          metadata: undefined,
          parts: [
            { type: 'step-start' },
            { text: 'He', type: 'text', state: 'streaming' },
          ],
        }),
      ),
    );
    const id = chat.messages.at(1)?.id;

    controller.write('llo');
    controller.close();
    await appendOperation;

    expect(id).toBeDefined();
    expect(chat.messages.at(1)).toEqual(
      expect.objectContaining({
        id,
        role: 'assistant',
      }),
    );
  });

  it('should invoke onFinish when the stream finishes', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: ['Hello', ',', ' world', '.'],
    };

    const onFinish = vi.fn();
    const chatWithOnFinish = new Chat({
      onFinish,
      transport: new TextStreamChatTransport({
        api: '/api/chat',
      }),
    });
    await chatWithOnFinish.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      isAbort: false,
      isDisconnect: false,
      isError: false,
      message: {
        id: expect.any(String),
        role: 'assistant',
        metadata: undefined,
        parts: [
          { type: 'step-start' },
          { text: 'Hello, world.', type: 'text', state: 'done' },
        ],
      },
      messages: [
        {
          id: expect.any(String),
          role: 'user',
          metadata: undefined,
          parts: [{ text: 'hi', type: 'text' }],
        },
        {
          id: expect.any(String),
          role: 'assistant',
          metadata: undefined,
          parts: [
            { type: 'step-start' },
            { text: 'Hello, world.', type: 'text', state: 'done' },
          ],
        },
      ],
    });
  });
});

describe('onToolCall', () => {
  let resolve: () => void;
  let toolCallPromise: Promise<void>;
  let chat: Chat;

  beforeEach(() => {
    ({ resolve, promise: toolCallPromise } = promiseWithResolvers<void>());

    chat = new Chat({
      async onToolCall({ toolCall }) {
        await toolCallPromise;

        chat.addToolOutput({
          tool: 'test-tool',
          toolCallId: toolCall.toolCallId,
          output: `test-tool-response: ${toolCall.toolName} ${
            toolCall.toolCallId
          } ${JSON.stringify(toolCall.input)}`,
        });
      },
    });
  });

  it("should invoke onToolCall when a tool call is received from the server's response", async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'tool-input-available',
          toolCallId: 'tool-call-0',
          toolName: 'test-tool',
          input: { testArg: 'test-value' },
        }),
      ],
    };

    const appendOperation = chat.sendMessage({ text: 'hi' });

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    resolve();
    await appendOperation;

    expect(chat.messages.at(1)?.parts.filter(isStaticToolUIPart)).toStrictEqual(
      [
        {
          state: 'output-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output:
            'test-tool-response: test-tool tool-call-0 {"testArg":"test-value"}',
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ],
    );
  });
});

describe('tool invocations', () => {
  let chat: Chat;

  beforeEach(() => {
    const generateId = mockId();
    chat = new Chat({
      generateId,
      transport: new DefaultChatTransport({
        api: '/api/chat',
      }),
    });
  });

  it('should display partial tool call, tool call, and tool result', async () => {
    const controller = new TestResponseController();
    server.urls['/api/chat'].response = {
      type: 'controlled-stream',
      controller,
    };

    const appendOperation = chat.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    controller.write(
      formatChunk({
        type: 'tool-input-start',
        toolCallId: 'tool-call-0',
        toolName: 'test-tool',
      }),
    );

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-streaming',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: undefined,
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    controller.write(
      formatChunk({
        type: 'tool-input-delta',
        toolCallId: 'tool-call-0',
        inputTextDelta: '{"testArg":"t',
      }),
    );

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-streaming',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 't' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    controller.write(
      formatChunk({
        type: 'tool-input-delta',
        toolCallId: 'tool-call-0',
        inputTextDelta: 'est-value"}}',
      }),
    );

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-streaming',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    controller.write(
      formatChunk({
        type: 'tool-input-available',
        toolCallId: 'tool-call-0',
        toolName: 'test-tool',
        input: { testArg: 'test-value' },
      }),
    );

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    controller.write(
      formatChunk({
        type: 'tool-output-available',
        toolCallId: 'tool-call-0',
        output: 'test-result',
      }),
    );
    controller.close();
    await appendOperation;

    expect(chat.messages.at(1)?.parts.filter(isStaticToolUIPart)).toStrictEqual(
      [
        {
          state: 'output-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: 'test-result',
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ],
    );
  });

  it('should display partial tool call and tool result (when there is no tool call streaming)', async () => {
    const controller = new TestResponseController();
    server.urls['/api/chat'].response = {
      type: 'controlled-stream',
      controller,
    };

    const appendOperation = chat.sendMessage({ text: 'hi' });

    controller.write(
      formatChunk({
        type: 'tool-input-available',
        toolCallId: 'tool-call-0',
        toolName: 'test-tool',
        input: { testArg: 'test-value' },
      }),
    );

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    controller.write(
      formatChunk({
        type: 'tool-output-available',
        toolCallId: 'tool-call-0',
        output: 'test-result',
      }),
    );
    controller.close();

    await appendOperation;

    expect(chat.messages.at(1)?.parts.filter(isStaticToolUIPart)).toStrictEqual(
      [
        {
          state: 'output-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: 'test-result',
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ],
    );
  });

  it('should update tool call to result when addToolOutput is called', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'tool-input-available',
          toolCallId: 'tool-call-0',
          toolName: 'test-tool',
          input: { testArg: 'test-value' },
        }),
      ],
    };

    await chat.sendMessage({
      text: 'hi',
    });

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'input-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: undefined,
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });

    chat.addToolOutput({
      tool: 'test-tool',
      toolCallId: 'tool-call-0',
      output: 'test-result',
    });

    await vi.waitFor(() => {
      expect(
        chat.messages.at(1)?.parts.filter(isStaticToolUIPart),
      ).toStrictEqual([
        {
          state: 'output-available',
          errorText: undefined,
          rawInput: undefined,
          toolCallId: 'tool-call-0',
          type: 'tool-test-tool',
          input: { testArg: 'test-value' },
          output: 'test-result',
          providerExecuted: undefined,
          preliminary: undefined,
          title: undefined,
        },
      ]);
    });
  });
});

describe('file attachments with data url', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should handle text file attachment and submission', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'text-start',
          id: '0',
        }),
        formatChunk({
          type: 'text-delta',
          id: '0',
          delta: 'Response to message with text attachment',
        }),
        formatChunk({
          type: 'text-end',
          id: '0',
        }),
      ],
    };

    await chat.sendMessage({
      text: 'Message with text attachment',
      files: createFileList(
        new File(['test file content'], 'test.txt', {
          type: 'text/plain',
        }),
      ),
    });

    expect(chat.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "id-1",
          "metadata": undefined,
          "parts": [
            {
              "filename": "test.txt",
              "mediaType": "text/plain",
              "type": "file",
              "url": "data:text/plain;base64,dGVzdCBmaWxlIGNvbnRlbnQ=",
            },
            {
              "text": "Message with text attachment",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "id": "id-2",
          "metadata": undefined,
          "parts": [
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Response to message with text attachment",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "parts": [
              {
                "filename": "test.txt",
                "mediaType": "text/plain",
                "type": "file",
                "url": "data:text/plain;base64,dGVzdCBmaWxlIGNvbnRlbnQ=",
              },
              {
                "text": "Message with text attachment",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ],
        "trigger": "submit-message",
      }
    `);
  });

  it('should handle image file attachment and submission', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'text-start',
          id: '0',
        }),
        formatChunk({
          type: 'text-delta',
          id: '0',
          delta: 'Response to message with image attachment',
        }),
        formatChunk({
          type: 'text-end',
          id: '0',
        }),
      ],
    };

    await chat.sendMessage({
      text: 'Message with image attachment',
      files: createFileList(
        new File(['test image content'], 'test.png', {
          type: 'image/png',
        }),
      ),
    });

    expect(chat.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "id-1",
          "metadata": undefined,
          "parts": [
            {
              "filename": "test.png",
              "mediaType": "image/png",
              "type": "file",
              "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
            },
            {
              "text": "Message with image attachment",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "id": "id-2",
          "metadata": undefined,
          "parts": [
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Response to message with image attachment",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "parts": [
              {
                "filename": "test.png",
                "mediaType": "image/png",
                "type": "file",
                "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
              },
              {
                "text": "Message with image attachment",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ],
        "trigger": "submit-message",
      }
    `);
  });
});

describe('file attachments with url', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should handle image file attachment and submission', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'text-start',
          id: '0',
        }),
        formatChunk({
          type: 'text-delta',
          id: '0',
          delta: 'Response to message with image attachment',
        }),
        formatChunk({
          type: 'text-end',
          id: '0',
        }),
      ],
    };

    await chat.sendMessage({
      text: 'Message with image attachment',
      files: createFileList(
        new File(['test image content'], 'test.png', {
          type: 'image/png',
        }),
      ),
    });

    expect(chat.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "id-1",
          "metadata": undefined,
          "parts": [
            {
              "filename": "test.png",
              "mediaType": "image/png",
              "type": "file",
              "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
            },
            {
              "text": "Message with image attachment",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "id": "id-2",
          "metadata": undefined,
          "parts": [
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Response to message with image attachment",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "parts": [
              {
                "filename": "test.png",
                "mediaType": "image/png",
                "type": "file",
                "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
              },
              {
                "text": "Message with image attachment",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ],
        "trigger": "submit-message",
      }
    `);
  });
});

describe('file attachments with empty text content', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should handle image file attachment and submission', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({
          type: 'text-start',
          id: '0',
        }),
        formatChunk({
          type: 'text-delta',
          id: '0',
          delta: 'Response to message with image attachment',
        }),
        formatChunk({
          type: 'text-end',
          id: '0',
        }),
      ],
    };

    await chat.sendMessage({
      files: createFileList(
        new File(['test image content'], 'test.png', {
          type: 'image/png',
        }),
      ),
    });

    flushSync();

    expect(chat.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "id-1",
          "metadata": undefined,
          "parts": [
            {
              "filename": "test.png",
              "mediaType": "image/png",
              "type": "file",
              "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
            },
          ],
          "role": "user",
        },
        {
          "id": "id-2",
          "metadata": undefined,
          "parts": [
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Response to message with image attachment",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "parts": [
              {
                "filename": "test.png",
                "mediaType": "image/png",
                "type": "file",
                "url": "data:image/png;base64,dGVzdCBpbWFnZSBjb250ZW50",
              },
            ],
            "role": "user",
          },
        ],
        "trigger": "submit-message",
      }
    `);
  });
});

describe('reload', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should show streamed response', async () => {
    server.urls['/api/chat'].response = [
      {
        type: 'stream-chunks',
        chunks: [
          formatChunk({ type: 'text-start', id: '0' }),
          formatChunk({
            type: 'text-delta',
            id: '0',
            delta: 'first response',
          }),
          formatChunk({ type: 'text-end', id: '0' }),
        ],
      },
      {
        type: 'stream-chunks',
        chunks: [
          formatChunk({ type: 'text-start', id: '0' }),
          formatChunk({
            type: 'text-delta',
            id: '0',
            delta: 'second response',
          }),
          formatChunk({ type: 'text-end', id: '0' }),
        ],
      },
    ];

    await chat.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(chat.messages.at(0)).toEqual(
      expect.objectContaining({
        role: 'user',
      }),
    );

    expect(chat.messages.at(1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        parts: [{ text: 'first response', type: 'text', state: 'done' }],
      }),
    );

    // Setup done, call regenerate:
    await chat.regenerate({
      body: { 'request-body-key': 'request-body-value' },
      headers: { 'header-key': 'header-value' },
    });

    expect(await server.calls[1].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "parts": [
              {
                "text": "hi",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ],
        "request-body-key": "request-body-value",
        "trigger": "regenerate-message",
      }
    `);

    expect(server.calls[1].requestHeaders).toStrictEqual({
      'content-type': 'application/json',
      'header-key': 'header-value',
    });

    expect(chat.messages.at(1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        parts: [{ text: 'second response', type: 'text', state: 'done' }],
      }),
    );
  });
});

describe('test sending additional fields during message submission', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat({
      generateId: mockId(),
    });
  });

  it('should send metadata with the message', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: ['0:"first response"\n'],
    };

    await chat.sendMessage({
      role: 'user',
      metadata: { test: 'example' },
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(chat.messages.at(0)).toEqual(
      expect.objectContaining({
        role: 'user',
      }),
    );

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "id": "id-0",
        "messages": [
          {
            "id": "id-1",
            "metadata": {
              "test": "example",
            },
            "parts": [
              {
                "text": "hi",
                "type": "text",
              },
            ],
            "role": "user",
          },
        ],
        "trigger": "submit-message",
      }
    `);
  });
});

describe('generateId function', () => {
  it('should use the provided generateId function for both user and assistant messages', async () => {
    server.urls['/api/chat'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({ type: 'start', messageId: '123' }),
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
      ],
    };

    const chatWithCustomId = new Chat({
      generateId: mockId({ prefix: 'testid' }),
    });

    await chatWithCustomId.sendMessage({
      role: 'user',
      parts: [{ text: 'hi', type: 'text' }],
    });

    expect(chatWithCustomId.messages).toMatchInlineSnapshot(`
      [
        {
          "id": "testid-1",
          "metadata": undefined,
          "parts": [
            {
              "text": "hi",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "id": "123",
          "metadata": undefined,
          "parts": [
            {
              "providerMetadata": undefined,
              "state": "done",
              "text": "Hello, world.",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });
});

describe('reactivity', () => {
  it('should be able to render as a derived', () => {
    const chat = $derived(new Chat({}));
    // If this isn't handled correctly, it'd show a `state_unsafe_mutation` error.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    chat.messages;
  });
});
