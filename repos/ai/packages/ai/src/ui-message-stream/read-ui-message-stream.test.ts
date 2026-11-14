import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
} from '@ai-sdk/provider-utils/test';
import type { UIMessageChunk } from './ui-message-chunks';
import { readUIMessageStream } from './read-ui-message-stream';
import { describe, it, expect } from 'vitest';

function createUIMessageStream(parts: UIMessageChunk[]) {
  return convertArrayToReadableStream(parts);
}

describe('readUIMessageStream', () => {
  it('should return a ui message object stream for a basic input stream', async () => {
    const stream = createUIMessageStream([
      { type: 'start', messageId: 'msg-123' },
      { type: 'start-step' },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello, ' },
      { type: 'text-delta', id: 'text-1', delta: 'world!' },
      { type: 'text-end', id: 'text-1' },
      { type: 'finish-step' },
      { type: 'finish' },
    ]);

    const uiMessages = readUIMessageStream({ stream });

    expect(await convertAsyncIterableToArray(uiMessages))
      .toMatchInlineSnapshot(`
        [
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [],
            "role": "assistant",
          },
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [
              {
                "type": "step-start",
              },
              {
                "providerMetadata": undefined,
                "state": "streaming",
                "text": "",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [
              {
                "type": "step-start",
              },
              {
                "providerMetadata": undefined,
                "state": "streaming",
                "text": "Hello, ",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [
              {
                "type": "step-start",
              },
              {
                "providerMetadata": undefined,
                "state": "streaming",
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
          {
            "id": "msg-123",
            "metadata": undefined,
            "parts": [
              {
                "type": "step-start",
              },
              {
                "providerMetadata": undefined,
                "state": "done",
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
  });

  it('should throw an error when encountering an error UI stream part', async () => {
    const stream = createUIMessageStream([
      { type: 'start', messageId: 'msg-123' },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello' },
      { type: 'error', errorText: 'Test error message' },
    ]);

    const uiMessages = readUIMessageStream({
      stream,
      terminateOnError: true,
    });

    await expect(convertAsyncIterableToArray(uiMessages)).rejects.toThrow(
      'Test error message',
    );
  });
});
