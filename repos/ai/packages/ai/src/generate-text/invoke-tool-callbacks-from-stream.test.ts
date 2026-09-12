import { tool, type ModelMessage } from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { LanguageModelStreamPart } from './stream-language-model-call';
import { invokeToolCallbacksFromStream } from './invoke-tool-callbacks-from-stream';

describe('invokeToolCallbacksFromStream', () => {
  it('should invoke tool callbacks in order and pass through the stream', async () => {
    const recordedCalls: unknown[] = [];
    const abortController = new AbortController();
    const runtimeContext = { requestId: 'req-1' };
    const stepInputMessages: Array<ModelMessage> = [
      { role: 'user', content: 'test-input' },
    ];

    const tools = {
      'test-tool': tool({
        inputSchema: z.object({ value: z.string() }),
        onInputStart: options => {
          recordedCalls.push({ type: 'onInputStart', options });
        },
        onInputDelta: options => {
          recordedCalls.push({ type: 'onInputDelta', options });
        },
        onInputAvailable: options => {
          recordedCalls.push({ type: 'onInputAvailable', options });
        },
      }),
    };

    const chunks: Array<LanguageModelStreamPart<typeof tools>> = [
      { type: 'text-delta', id: 'text-1', text: 'hello' },
      { type: 'tool-input-start', id: 'call-1', toolName: 'test-tool' },
      { type: 'tool-input-delta', id: 'call-1', delta: '{"value":"' },
      { type: 'tool-input-delta', id: 'call-1', delta: 'Sparkle Day"}' },
      { type: 'tool-input-end', id: 'call-1' },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'test-tool',
        input: { value: 'Sparkle Day' },
      },
    ];

    const result = invokeToolCallbacksFromStream({
      stream: convertArrayToReadableStream(chunks),
      tools,
      stepInputMessages,
      abortSignal: abortController.signal,
      runtimeContext,
    });
    const resultChunks = await convertReadableStreamToArray(result);
    const recordedCallsForSnapshot = recordedCalls.map(call => ({
      ...((call as { type: string; options: Record<string, unknown> }) ?? {}),
      options: {
        ...(call as { options: Record<string, unknown> }).options,
        abortSignal: '[AbortSignal]',
      },
    }));

    expect(resultChunks).toMatchInlineSnapshot(`
      [
        {
          "id": "text-1",
          "text": "hello",
          "type": "text-delta",
        },
        {
          "id": "call-1",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"value":"",
          "id": "call-1",
          "type": "tool-input-delta",
        },
        {
          "delta": "Sparkle Day"}",
          "id": "call-1",
          "type": "tool-input-delta",
        },
        {
          "id": "call-1",
          "type": "tool-input-end",
        },
        {
          "input": {
            "value": "Sparkle Day",
          },
          "toolCallId": "call-1",
          "toolName": "test-tool",
          "type": "tool-call",
        },
      ]
    `);
    expect(recordedCallsForSnapshot).toMatchInlineSnapshot(`
      [
        {
          "options": {
            "abortSignal": "[AbortSignal]",
            "context": {
              "requestId": "req-1",
            },
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCallId": "call-1",
          },
          "type": "onInputStart",
        },
        {
          "options": {
            "abortSignal": "[AbortSignal]",
            "context": {
              "requestId": "req-1",
            },
            "inputTextDelta": "{"value":"",
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCallId": "call-1",
          },
          "type": "onInputDelta",
        },
        {
          "options": {
            "abortSignal": "[AbortSignal]",
            "context": {
              "requestId": "req-1",
            },
            "inputTextDelta": "Sparkle Day"}",
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCallId": "call-1",
          },
          "type": "onInputDelta",
        },
        {
          "options": {
            "abortSignal": "[AbortSignal]",
            "context": {
              "requestId": "req-1",
            },
            "input": {
              "value": "Sparkle Day",
            },
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCallId": "call-1",
          },
          "type": "onInputAvailable",
        },
      ]
    `);
    expect(
      recordedCalls.every(
        call =>
          (
            call as {
              options: { abortSignal: AbortSignal | undefined };
            }
          ).options.abortSignal === abortController.signal,
      ),
    ).toBe(true);
  });
});
