import { DelayedPromise } from '@ai-sdk/provider-utils';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from '../ui/ui-messages';
import { consumeStream } from '../util/consume-stream';
import { createUIMessageStream } from './create-ui-message-stream';
import type { UIMessageChunk } from './ui-message-chunks';
import type { UIMessageStreamWriter } from './ui-message-stream-writer';

describe('createUIMessageStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send data stream part and close the stream', async () => {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: '1' });
        writer.write({ type: 'text-delta', id: '1', delta: '1a' });
        writer.write({ type: 'text-end', id: '1' });
      },
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
      ]
    `);
  });

  it('should forward a single stream with 2 elements', async () => {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.merge(
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-delta', id: '1', delta: '1a' });
              controller.enqueue({ type: 'text-delta', id: '1', delta: '1b' });
              controller.close();
            },
          }),
        );
      },
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "1b",
          "id": "1",
          "type": "text-delta",
        },
      ]
    `);
  });

  it('should send async message annotation and close the stream', async () => {
    const wait = new DelayedPromise<void>();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        await wait.promise;
        writer.write({ type: 'text-delta', id: '1', delta: '1a' });
      },
    });

    wait.resolve(undefined);

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
      ]
    `);
  });

  it('should forward elements from multiple streams and data parts', async () => {
    let controller1: ReadableStreamDefaultController<UIMessageChunk>;
    let controller2: ReadableStreamDefaultController<UIMessageChunk>;

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-delta', id: '1', delta: 'data-part-1' });

        writer.merge(
          new ReadableStream({
            start(controllerArg) {
              controller1 = controllerArg;
            },
          }),
        );

        controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1a' });
        writer.write({ type: 'text-delta', id: '1', delta: 'data-part-2' });
        controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1b' });

        writer.merge(
          new ReadableStream({
            start(controllerArg) {
              controller2 = controllerArg;
            },
          }),
        );

        writer.write({ type: 'text-delta', id: '1', delta: 'data-part-3' });
      },
    });

    controller2!.enqueue({ type: 'text-delta', id: '2', delta: '2a' });
    controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1c' });
    controller2!.enqueue({ type: 'text-delta', id: '2', delta: '2b' });
    controller2!.close();
    controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1d' });
    controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1e' });
    controller1!.close();

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "delta": "data-part-1",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "data-part-2",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "data-part-3",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "2a",
          "id": "2",
          "type": "text-delta",
        },
        {
          "delta": "1b",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "2b",
          "id": "2",
          "type": "text-delta",
        },
        {
          "delta": "1c",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "1d",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "1e",
          "id": "1",
          "type": "text-delta",
        },
      ]
    `);
  });

  it('should add error parts when stream errors', async () => {
    let controller1: ReadableStreamDefaultController<UIMessageChunk>;
    let controller2: ReadableStreamDefaultController<UIMessageChunk>;

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.merge(
          new ReadableStream({
            start(controllerArg) {
              controller1 = controllerArg;
            },
          }),
        );
        writer.merge(
          new ReadableStream({
            start(controllerArg) {
              controller2 = controllerArg;
            },
          }),
        );
      },
      onError: () => 'error-message',
    });

    controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1a' });
    controller1!.error(new Error('1-error'));
    controller2!.enqueue({ type: 'text-delta', id: '2', delta: '2a' });
    controller2!.enqueue({ type: 'text-delta', id: '2', delta: '2b' });
    controller2!.close();

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "2a",
          "id": "2",
          "type": "text-delta",
        },
        {
          "delta": "2b",
          "id": "2",
          "type": "text-delta",
        },
        {
          "errorText": "error-message",
          "type": "error",
        },
      ]
    `);
  });

  it('should add error parts when execute throws', async () => {
    const stream = createUIMessageStream({
      execute: () => {
        throw new Error('execute-error');
      },
      onError: () => 'error-message',
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "errorText": "error-message",
          "type": "error",
        },
      ]
    `);
  });

  it('should add error parts when execute throws with promise', async () => {
    const stream = createUIMessageStream({
      execute: async () => {
        throw new Error('execute-error');
      },
      onError: () => 'error-message',
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "errorText": "error-message",
          "type": "error",
        },
      ]
    `);
  });

  it('should suppress error when writing to closed stream', async () => {
    let uiMessageStreamWriter: UIMessageStreamWriter<UIMessage>;

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-delta', id: '1', delta: '1a' });
        uiMessageStreamWriter = writer;
      },
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
      ]
    `);

    expect(() =>
      uiMessageStreamWriter!.write({
        type: 'text-delta',
        id: '1',
        delta: '1b',
      }),
    ).not.toThrow();
  });

  it('should support writing from delayed merged streams', async () => {
    let uiMessageStreamWriter: UIMessageStreamWriter<UIMessage>;
    let controller1: ReadableStreamDefaultController<UIMessageChunk>;
    let controller2: ReadableStreamDefaultController<UIMessageChunk>;
    let done = false;

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.merge(
          new ReadableStream({
            start(controllerArg) {
              controller1 = controllerArg;
            },
          }),
        );

        uiMessageStreamWriter = writer;
        done = true;
      },
    });

    const result: UIMessageChunk[] = [];
    const reader = stream.getReader();
    async function pull() {
      const { value, done } = await reader.read();
      result.push(value!);
    }

    // function is finished
    expect(done).toBe(true);

    controller1!.enqueue({ type: 'text-delta', id: '1', delta: '1a' });
    await pull();

    // controller1 is still open, create 2nd stream
    uiMessageStreamWriter!.merge(
      new ReadableStream({
        start(controllerArg) {
          controller2 = controllerArg;
        },
      }),
    );

    // close controller1
    controller1!.close();

    await vi.advanceTimersByTimeAsync(0); // relinquish control

    // it should still be able to write to controller2
    controller2!.enqueue({ type: 'text-delta', id: '2', delta: '2a' });
    controller2!.close();

    await pull();

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "delta": "1a",
          "id": "1",
          "type": "text-delta",
        },
        {
          "delta": "2a",
          "id": "2",
          "type": "text-delta",
        },
      ]
    `);
  });

  it('should handle onFinish without original messages', async () => {
    const recordedOptions: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: '1' });
        writer.write({ type: 'text-delta', id: '1', delta: '1a' });
        writer.write({ type: 'text-end', id: '1' });
      },
      onFinish: options => {
        recordedOptions.push(options);
      },
      generateId: () => 'response-message-id',
    });

    await consumeStream({ stream });

    expect(recordedOptions).toMatchInlineSnapshot(`
      [
        {
          "finishReason": undefined,
          "isAborted": false,
          "isContinuation": false,
          "messages": [
            {
              "id": "response-message-id",
              "metadata": undefined,
              "parts": [
                {
                  "providerMetadata": undefined,
                  "state": "done",
                  "text": "1a",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
          "responseMessage": {
            "id": "response-message-id",
            "metadata": undefined,
            "parts": [
              {
                "providerMetadata": undefined,
                "state": "done",
                "text": "1a",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        },
      ]
    `);
  });

  it('should handle onEnd without original messages', async () => {
    const recordedOptions: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: '1' });
        writer.write({ type: 'text-delta', id: '1', delta: '1a' });
        writer.write({ type: 'text-end', id: '1' });
      },
      onEnd: options => {
        recordedOptions.push(options);
      },
      generateId: () => 'response-message-id',
    });

    await consumeStream({ stream });

    expect(recordedOptions).toHaveLength(1);
    expect(recordedOptions[0]).toMatchObject({
      isAborted: false,
      isContinuation: false,
      responseMessage: {
        id: 'response-message-id',
        role: 'assistant',
        parts: [
          {
            state: 'done',
            text: '1a',
            type: 'text',
          },
        ],
      },
    });
  });

  it('should handle onFinish with messages', async () => {
    const recordedOptions: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: '1' });
        writer.write({ type: 'text-delta', id: '1', delta: '1b' });
        writer.write({ type: 'text-end', id: '1' });
      },
      originalMessages: [
        {
          id: '0',
          role: 'user',
          parts: [{ type: 'text', text: '0a' }],
        },
        {
          id: '1',
          role: 'assistant',
          parts: [{ type: 'text', text: '1a', state: 'done' }],
        },
      ],
      onFinish: options => {
        recordedOptions.push(options);
      },
    });

    await consumeStream({ stream });

    expect(recordedOptions).toMatchInlineSnapshot(`
      [
        {
          "finishReason": undefined,
          "isAborted": false,
          "isContinuation": true,
          "messages": [
            {
              "id": "0",
              "parts": [
                {
                  "text": "0a",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "id": "1",
              "parts": [
                {
                  "state": "done",
                  "text": "1a",
                  "type": "text",
                },
                {
                  "providerMetadata": undefined,
                  "state": "done",
                  "text": "1b",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ],
          "responseMessage": {
            "id": "1",
            "parts": [
              {
                "state": "done",
                "text": "1a",
                "type": "text",
              },
              {
                "providerMetadata": undefined,
                "state": "done",
                "text": "1b",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        },
      ]
    `);
  });

  it('should inject a messageId into the stream when originalMessages are provided', async () => {
    const recordedOptions: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start' }); // no messageId
      },
      originalMessages: [
        { id: '0', role: 'user', parts: [{ type: 'text', text: '0a' }] },
        // no assistant message
      ],
      onFinish(options) {
        recordedOptions.push(options);
      },
      generateId: () => 'response-message-id',
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "messageId": "response-message-id",
          "type": "start",
        },
      ]
    `);
    expect(recordedOptions).toMatchInlineSnapshot(`
      [
        {
          "finishReason": undefined,
          "isAborted": false,
          "isContinuation": false,
          "messages": [
            {
              "id": "0",
              "parts": [
                {
                  "text": "0a",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "id": "response-message-id",
              "metadata": undefined,
              "parts": [],
              "role": "assistant",
            },
          ],
          "responseMessage": {
            "id": "response-message-id",
            "metadata": undefined,
            "parts": [],
            "role": "assistant",
          },
        },
      ]
    `);
  });

  it('should keep existing messageId from start chunk when originalMessages are provided', async () => {
    const recordedOptions: any[] = [];

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start', messageId: 'existing-message-id' });
      },
      originalMessages: [
        { id: '0', role: 'user', parts: [{ type: 'text', text: '0a' }] },
        // no assistant message
      ],
      onFinish(options) {
        recordedOptions.push(options);
      },
      generateId: () => 'response-message-id',
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "messageId": "existing-message-id",
          "type": "start",
        },
      ]
    `);
    expect(recordedOptions).toMatchInlineSnapshot(`
      [
        {
          "finishReason": undefined,
          "isAborted": false,
          "isContinuation": false,
          "messages": [
            {
              "id": "0",
              "parts": [
                {
                  "text": "0a",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "id": "existing-message-id",
              "metadata": undefined,
              "parts": [],
              "role": "assistant",
            },
          ],
          "responseMessage": {
            "id": "existing-message-id",
            "metadata": undefined,
            "parts": [],
            "role": "assistant",
          },
        },
      ]
    `);
  });
});
