import { describe, expect, it } from 'vitest';
import { getResponseUIMessageId } from './get-response-ui-message-id';
import type { UIMessage } from '../ui/ui-messages';

describe('getResponseUIMessageId', () => {
  const mockGenerateId = () => 'new-id';

  it('should return undefined when originalMessages is null', () => {
    const result = getResponseUIMessageId({
      originalMessages: undefined,
      responseMessageId: mockGenerateId,
    });
    expect(result).toBeUndefined();
  });

  it('should return the last assistant message id when present', () => {
    const messages: UIMessage[] = [
      { id: 'msg-1', role: 'user', parts: [] },
      { id: 'msg-2', role: 'assistant', parts: [] },
    ];
    const result = getResponseUIMessageId({
      originalMessages: messages,
      responseMessageId: mockGenerateId,
    });
    expect(result).toBe('msg-2');
  });

  it('should generate new id when last message is not from assistant', () => {
    const messages: UIMessage[] = [
      { id: 'msg-1', role: 'assistant', parts: [] },
      { id: 'msg-2', role: 'user', parts: [] },
    ];
    const result = getResponseUIMessageId({
      originalMessages: messages,
      responseMessageId: mockGenerateId,
    });
    expect(result).toBe('new-id');
  });

  it('should generate new id when messages array is empty', () => {
    const result = getResponseUIMessageId({
      originalMessages: [],
      responseMessageId: mockGenerateId,
    });
    expect(result).toBe('new-id');
  });

  it('should use the responseMessageId when it is a string', () => {
    const result = getResponseUIMessageId({
      originalMessages: [],
      responseMessageId: 'response-id',
    });
    expect(result).toBe('response-id');
  });
});
