import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it, vi } from 'vitest';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import type { LanguageModelUsage } from '../types/usage';
import type { UIMessage } from '../ui/ui-messages';
import { toUIMessageStream } from './to-ui-message-stream';

const testUsage: LanguageModelUsage = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  inputTokenDetails: {
    noCacheTokens: undefined,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokenDetails: {
    textTokens: undefined,
    reasoningTokens: undefined,
  },
};

describe('toUIMessageStream', () => {
  it('maps text and lifecycle parts to UI message chunks', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'start' },
      { type: 'start-step', request: {}, warnings: [] },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', text: 'Hello' },
      { type: 'text-delta', id: 't1', text: ', world!' },
      { type: 'text-end', id: 't1' },
      {
        type: 'finish-step',
        response: { id: 'r', modelId: 'm', timestamp: new Date(0) },
        usage: testUsage,
        performance: {
          effectiveOutputTokensPerSecond: 0,
          outputTokensPerSecond: 0,
          inputTokensPerSecond: 0,
          effectiveTotalTokensPerSecond: 0,
          stepTimeMs: 0,
          responseTimeMs: 0,
          toolExecutionMs: {},
          timeToFirstOutputMs: undefined,
        },
        finishReason: 'stop',
        rawFinishReason: 'stop',
        providerMetadata: undefined,
      },
      {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: testUsage,
      },
    ];

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
      }),
    );

    expect(chunks).toEqual([
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hello' },
      { type: 'text-delta', id: 't1', delta: ', world!' },
      { type: 'text-end', id: 't1' },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'stop' },
    ]);
  });

  it('attaches the generated message id to the start chunk when provided', async () => {
    const parts: TextStreamPart<{}>[] = [{ type: 'start' }];
    const generateMessageId = vi.fn(() => 'msg-123');

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        generateMessageId,
      }),
    );

    expect(chunks).toEqual([{ type: 'start', messageId: 'msg-123' }]);
    expect(generateMessageId).toHaveBeenCalledTimes(1);
  });

  it('suppresses start/finish chunks when sendStart/sendFinish are false', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'start' },
      { type: 'text-start', id: 't1' },
      { type: 'text-end', id: 't1' },
      {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: testUsage,
      },
    ];

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        sendStart: false,
        sendFinish: false,
      }),
    );

    expect(chunks).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-end', id: 't1' },
    ]);
  });

  it('skips reasoning parts when sendReasoning is false', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', text: 'thinking' },
      { type: 'reasoning-end', id: 'r1' },
    ];

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        sendReasoning: false,
      }),
    );

    expect(chunks).toEqual([]);
  });

  it('routes error parts through onError', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'error', error: new Error('boom') },
    ];

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        onError: error => `handled: ${(error as Error).message}`,
      }),
    );

    expect(chunks).toEqual([{ type: 'error', errorText: 'handled: boom' }]);
  });

  it('emits separate metadata chunks for non-lifecycle parts', async () => {
    type MetadataUIMessage = UIMessage<{ partType: string }>;

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream<{}, MetadataUIMessage>({
        stream: convertArrayToReadableStream([
          { type: 'start' },
          { type: 'text-delta', id: 't1', text: 'Hello' },
          {
            type: 'finish',
            finishReason: 'stop',
            rawFinishReason: 'stop',
            totalUsage: testUsage,
          },
        ] satisfies TextStreamPart<{}>[]),
        tools: undefined,
        messageMetadata: ({ part }) => ({ partType: part.type }),
      }),
    );

    expect(chunks).toEqual([
      {
        type: 'start',
        messageMetadata: { partType: 'start' },
      },
      {
        type: 'text-delta',
        id: 't1',
        delta: 'Hello',
      },
      {
        type: 'message-metadata',
        messageMetadata: { partType: 'text-delta' },
      },
      {
        type: 'finish',
        finishReason: 'stop',
        messageMetadata: { partType: 'finish' },
      },
    ]);
  });

  it('injects generated message id and calls onFinish', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'start' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', text: 'Hello' },
      { type: 'text-end', id: 't1' },
      {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: testUsage,
      },
    ];
    const originalMessages: UIMessage[] = [
      {
        id: 'user-msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hi' }],
      },
    ];
    const generateMessageId = vi.fn(() => 'msg-123');
    const onFinish = vi.fn();

    const chunks = await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        originalMessages,
        generateMessageId,
        onFinish,
      }),
    );

    expect(chunks[0]).toEqual({ type: 'start', messageId: 'msg-123' });
    expect(generateMessageId).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({
      isAborted: false,
      isContinuation: false,
      finishReason: 'stop',
      responseMessage: {
        id: 'msg-123',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      messages: [
        originalMessages[0],
        {
          id: 'msg-123',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });
  });

  it('calls onEnd when stream finishes', async () => {
    const parts: TextStreamPart<{}>[] = [
      { type: 'start' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', text: 'Hello' },
      { type: 'text-end', id: 't1' },
      {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: testUsage,
      },
    ];
    const onEnd = vi.fn();
    const onFinish = vi.fn();

    await convertReadableStreamToArray(
      toUIMessageStream({
        stream: convertArrayToReadableStream(parts),
        tools: undefined,
        generateMessageId: () => 'msg-123',
        onEnd,
        onFinish,
      }),
    );

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0]).toMatchObject({
      isAborted: false,
      isContinuation: false,
      finishReason: 'stop',
      responseMessage: {
        id: 'msg-123',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    });
    expect(onFinish).not.toHaveBeenCalled();
  });
});
