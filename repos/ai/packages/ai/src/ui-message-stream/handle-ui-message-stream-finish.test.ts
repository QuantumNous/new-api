import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import type { UIMessage } from '../ui/ui-messages';
import { handleUIMessageStreamFinish } from './handle-ui-message-stream-finish';
import type { UIMessageChunk } from './ui-message-chunks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createUIMessageStream(parts: UIMessageChunk[]) {
  return convertArrayToReadableStream(parts);
}

describe('handleUIMessageStreamFinish', () => {
  const mockErrorHandler = vi.fn();

  beforeEach(() => {
    mockErrorHandler.mockClear();
  });

  describe('stream pass-through without onFinish', () => {
    it('should pass through stream chunks without processing when onFinish is not provided', async () => {
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-123' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-delta', id: 'text-1', delta: ' World' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-123',
        originalMessages: [],
        onError: mockErrorHandler,
        // onFinish is not provided
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(mockErrorHandler).not.toHaveBeenCalled();
    });

    it('should inject messageId when not present in start chunk', async () => {
      const inputChunks: UIMessageChunk[] = [
        { type: 'start' }, // no messageId
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Test' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'injected-123',
        originalMessages: [],
        onError: mockErrorHandler,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result[0]).toEqual({ type: 'start', messageId: 'injected-123' });
      expect(result.slice(1)).toEqual(inputChunks.slice(1));
    });
  });

  describe('stream processing with onFinish callback', () => {
    it('should process stream and call onFinish with correct parameters', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-456' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-delta', id: 'text-1', delta: ' World' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-456',
        originalMessages,
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.responseMessage.id).toBe('msg-456');
      expect(callArgs.responseMessage.role).toBe('assistant');
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0]).toEqual(originalMessages[0]);
      expect(callArgs.messages[1]).toEqual(callArgs.responseMessage);
    });

    it('should prefer onEnd over deprecated onFinish', async () => {
      const onEndCallback = vi.fn();
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-456' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-456',
        onError: mockErrorHandler,
        onEnd: onEndCallback,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onEndCallback).toHaveBeenCalledTimes(1);
      expect(onFinishCallback).not.toHaveBeenCalled();
    });

    it('should handle empty original messages array', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-789' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Response' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-789',
        originalMessages: [],
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0]).toEqual(callArgs.responseMessage);
    });
  });

  describe('stream processing with continuation scenario', () => {
    it('should handle continuation when last message is assistant', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'assistant-msg-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: ' continued' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Continue this' }],
        },
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'This is' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-999', // this should be ignored since we're continuing
        originalMessages,
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(true);
      expect(callArgs.responseMessage.id).toBe('assistant-msg-1'); // uses the existing assistant message id
      expect(callArgs.messages).toHaveLength(2); // original user message + updated assistant message
      expect(callArgs.messages[0]).toEqual(originalMessages[0]);
      expect(callArgs.messages[1]).toEqual(callArgs.responseMessage);
    });

    it('should not treat user message as continuation', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-001' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'New response' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Question' }],
        },
        {
          id: 'user-msg-2',
          role: 'user',
          parts: [{ type: 'text', text: 'Another question' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-001',
        originalMessages,
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.responseMessage.id).toBe('msg-001');
      expect(callArgs.messages).toHaveLength(3); // 2 user messages + 1 new assistant message
    });
  });

  describe('abort scenarios', () => {
    it('should set isAborted to true when abort chunk is encountered', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-abort-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Starting text' },
        { type: 'abort' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Test request' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-abort-1',
        originalMessages,
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isAborted).toBe(true);
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.responseMessage.id).toBe('msg-abort-1');
      expect(callArgs.messages).toHaveLength(2);
    });

    it('should pass through abort reason when provided', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-abort-reason' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Starting text' },
        { type: 'abort', reason: 'manual abort' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-abort-reason',
        originalMessages: [],
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(onFinishCallback).toHaveBeenCalledTimes(1);
    });

    it('should set isAborted to false when no abort chunk is encountered', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-normal' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Complete text' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Test request' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-normal',
        originalMessages,
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isAborted).toBe(false);
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.responseMessage.id).toBe('msg-normal');
    });

    it('should handle abort chunk in pass-through mode without onFinish', async () => {
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-abort-passthrough' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Text before abort' },
        { type: 'abort' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-abort-passthrough',
        originalMessages: [],
        onError: mockErrorHandler,
        // onFinish is not provided
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(mockErrorHandler).not.toHaveBeenCalled();
    });

    it('should handle multiple abort chunks correctly', async () => {
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-multiple-abort' },
        { type: 'text-start', id: 'text-1' },
        { type: 'abort' },
        { type: 'text-delta', id: 'text-1', delta: 'Some text' },
        { type: 'abort' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-multiple-abort',
        originalMessages: [],
        onError: mockErrorHandler,
        onFinish: onFinishCallback,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(onFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onFinishCallback.mock.calls[0][0];
      expect(callArgs.isAborted).toBe(true);
    });

    it('should call onFinish when reader is cancelled (simulating browser close/navigation)', async () => {
      await expectUndefinedUnhandledRejections(async () => {
        const onFinishCallback = vi.fn();

        const inputChunks: UIMessageChunk[] = [
          { type: 'start', messageId: 'msg-1' },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        ];

        const stream = createUIMessageStream(inputChunks);

        const resultStream = handleUIMessageStreamFinish<UIMessage>({
          stream,
          messageId: 'msg-1',
          originalMessages: [],
          onError: mockErrorHandler,
          onFinish: onFinishCallback,
        });

        const reader = resultStream.getReader();
        await reader.read();
        await reader.cancel();
        reader.releaseLock();

        expect(onFinishCallback).toHaveBeenCalledTimes(1);

        const callArgs = onFinishCallback.mock.calls[0][0];
        expect(callArgs.isAborted).toBe(false);
        expect(callArgs.responseMessage.id).toBe('msg-1');
      });
    });
  });

  describe('onStepFinish callback', () => {
    it('should call onStepEnd when finish-step chunk is encountered', async () => {
      const onStepEndCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-step-end' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const resultStream = handleUIMessageStreamFinish({
        stream: convertArrayToReadableStream(inputChunks as any),
        originalMessages: [],
        onError: mockErrorHandler,
        onStepEnd: onStepEndCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onStepEndCallback).toHaveBeenCalledTimes(1);
      expect(onStepEndCallback.mock.calls[0][0].responseMessage.id).toBe(
        'msg-step-end',
      );
    });

    it('should prefer onStepEnd over deprecated onStepFinish', async () => {
      const onStepEndCallback = vi.fn();
      const onStepFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-step-end' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const resultStream = handleUIMessageStreamFinish({
        stream: convertArrayToReadableStream(inputChunks as any),
        originalMessages: [],
        onError: mockErrorHandler,
        onStepEnd: onStepEndCallback,
        onStepFinish: onStepFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onStepEndCallback).toHaveBeenCalledTimes(1);
      expect(onStepFinishCallback).not.toHaveBeenCalled();
    });

    it('should call onStepFinish when finish-step chunk is encountered', async () => {
      const onStepFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-step-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Step 1 text' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-step-1',
        originalMessages,
        onError: mockErrorHandler,
        onStepFinish: onStepFinishCallback,
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(onStepFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onStepFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(false);
      expect(callArgs.responseMessage.id).toBe('msg-step-1');
      expect(callArgs.responseMessage.role).toBe('assistant');
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0]).toEqual(originalMessages[0]);
      expect(callArgs.messages[1].id).toBe('msg-step-1');
    });

    it('should call onStepFinish multiple times for multiple steps', async () => {
      const onStepFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-multi-step' },
        // Step 1
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Step 1' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        // Step 2
        { type: 'start-step' },
        { type: 'text-start', id: 'text-2' },
        { type: 'text-delta', id: 'text-2', delta: 'Step 2' },
        { type: 'text-end', id: 'text-2' },
        { type: 'finish-step' },
        // Step 3
        { type: 'start-step' },
        { type: 'text-start', id: 'text-3' },
        { type: 'text-delta', id: 'text-3', delta: 'Step 3' },
        { type: 'text-end', id: 'text-3' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-multi-step',
        originalMessages: [],
        onError: mockErrorHandler,
        onStepFinish: onStepFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onStepFinishCallback).toHaveBeenCalledTimes(3);

      // Verify each step has the correct accumulated content
      const step1Args = onStepFinishCallback.mock.calls[0][0];
      expect(step1Args.responseMessage.parts).toHaveLength(1);

      const step2Args = onStepFinishCallback.mock.calls[1][0];
      expect(step2Args.responseMessage.parts).toHaveLength(3); // step-start + 2 text parts

      const step3Args = onStepFinishCallback.mock.calls[2][0];
      expect(step3Args.responseMessage.parts).toHaveLength(5); // 2 step-starts + 3 text parts
    });

    it('should call both onStepFinish and onFinish when both are provided', async () => {
      const onStepFinishCallback = vi.fn();
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-both' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-both',
        originalMessages: [],
        onError: mockErrorHandler,
        onStepFinish: onStepFinishCallback,
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onStepFinishCallback).toHaveBeenCalledTimes(1);
      expect(onFinishCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle onStepFinish errors by logging and continuing', async () => {
      const onStepFinishCallback = vi
        .fn()
        .mockRejectedValue(new Error('DB error'));
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-error' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Step 1' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'start-step' },
        { type: 'text-start', id: 'text-2' },
        { type: 'text-delta', id: 'text-2', delta: 'Step 2' },
        { type: 'text-end', id: 'text-2' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-error',
        originalMessages: [],
        onError: mockErrorHandler,
        onStepFinish: onStepFinishCallback,
      });

      // Stream should complete without throwing
      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      // Both steps should have been attempted
      expect(onStepFinishCallback).toHaveBeenCalledTimes(2);
      // Error should have been logged twice
      expect(mockErrorHandler).toHaveBeenCalledTimes(2);
      expect(mockErrorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle continuation scenario with onStepFinish', async () => {
      const onStepFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'assistant-msg-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: ' continued' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const originalMessages: UIMessage[] = [
        {
          id: 'user-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Continue this' }],
        },
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'This is' }],
        },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-999',
        originalMessages,
        onError: mockErrorHandler,
        onStepFinish: onStepFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      expect(onStepFinishCallback).toHaveBeenCalledTimes(1);

      const callArgs = onStepFinishCallback.mock.calls[0][0];
      expect(callArgs.isContinuation).toBe(true);
      expect(callArgs.responseMessage.id).toBe('assistant-msg-1');
      expect(callArgs.messages).toHaveLength(2);
    });

    it('should provide deep-cloned messages in onStepFinish to prevent mutation', async () => {
      const onStepFinishCallback = vi.fn();
      const onFinishCallback = vi.fn();
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-clone' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-clone',
        originalMessages: [],
        onError: mockErrorHandler,
        onStepFinish: event => {
          // Mutate the message in the callback
          event.responseMessage.parts.push({ type: 'text', text: 'MUTATION!' });
          onStepFinishCallback(event);
        },
        onFinish: onFinishCallback,
      });

      await convertReadableStreamToArray(resultStream);

      // Verify onStepFinish was called and received the mutated message
      expect(onStepFinishCallback).toHaveBeenCalledTimes(1);
      const stepMessage = onStepFinishCallback.mock.calls[0][0].responseMessage;
      expect(stepMessage.parts).toHaveLength(2); // Original + mutation

      // onFinish should NOT see the mutation from onStepFinish
      const finishMessage = onFinishCallback.mock.calls[0][0].responseMessage;
      expect(finishMessage.parts).toHaveLength(1);
    });

    it('should not process stream when neither onFinish nor onStepFinish is provided', async () => {
      const inputChunks: UIMessageChunk[] = [
        { type: 'start', messageId: 'msg-passthrough' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Test' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ];

      const stream = createUIMessageStream(inputChunks);

      const resultStream = handleUIMessageStreamFinish<UIMessage>({
        stream,
        messageId: 'msg-passthrough',
        originalMessages: [],
        onError: mockErrorHandler,
        // Neither onFinish nor onStepFinish provided
      });

      const result = await convertReadableStreamToArray(resultStream);

      expect(result).toEqual(inputChunks);
      expect(mockErrorHandler).not.toHaveBeenCalled();
    });
  });
});

async function expectUndefinedUnhandledRejections(
  fn: () => Promise<void>,
): Promise<void> {
  const listeners = process.listeners('unhandledRejection');
  const reasons: unknown[] = [];

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', reason => {
    reasons.push(reason);
  });

  try {
    await fn();
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    process.removeAllListeners('unhandledRejection');
    for (const listener of listeners) {
      process.on('unhandledRejection', listener);
    }
  }

  expect(reasons).toEqual(
    Array.from({ length: reasons.length }, () => undefined),
  );
  expect(reasons.length).toBeLessThanOrEqual(1);
}
