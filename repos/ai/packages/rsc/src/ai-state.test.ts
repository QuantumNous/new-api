import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withAIState,
  getAIState,
  getMutableAIState,
  sealMutableAIState,
  getAIStateDeltaPromise,
} from './ai-state';

describe('AI State Management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should get the current AI state', () => {
    const initialState = { foo: 'bar' };
    const result = withAIState({ state: initialState, options: {} }, () => {
      return getAIState();
    });
    expect(result).toEqual(initialState);
  });

  it('should get a specific key from the AI state', () => {
    const initialState = { foo: 'bar', baz: 'qux' };
    const result = withAIState({ state: initialState, options: {} }, () => {
      return getAIState('foo');
    });
    expect(result).toBe('bar');
  });

  it('should update the AI state', () => {
    const initialState = { foo: 'bar' };
    withAIState({ state: initialState, options: {} }, () => {
      const mutableState = getMutableAIState();
      mutableState.update({ foo: 'baz' });
      expect(getAIState()).toEqual({ foo: 'baz' });
    });
  });

  it('should update a specific key in the AI state', () => {
    const initialState = { foo: 'bar', baz: 'qux' };
    withAIState({ state: initialState, options: {} }, () => {
      const mutableState = getMutableAIState('foo');
      mutableState.update('newValue');
      expect(getAIState()).toEqual({ foo: 'newValue', baz: 'qux' });
    });
  });

  it('should throw an error when accessing AI state outside of withAIState', () => {
    expect(() => getAIState()).toThrow(
      '`getAIState` must be called within an AI Action.',
    );
  });

  it('should throw an error when updating AI state after it has been sealed', () => {
    withAIState({ state: {}, options: {} }, () => {
      sealMutableAIState();
      expect(() => getMutableAIState()).toThrow(
        '`getMutableAIState` must be called before returning from an AI Action.',
      );
    });
  });

  it('should call onSetAIState when updating state', () => {
    const onSetAIState = vi.fn();
    const initialState = { foo: 'bar' };
    withAIState({ state: initialState, options: { onSetAIState } }, () => {
      const mutableState = getMutableAIState();
      mutableState.update({ foo: 'baz' });
      mutableState.done({ foo: 'baz' });
    });
    expect(onSetAIState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { foo: 'baz' },
        done: true,
      }),
    );
  });

  it('should handle updates with and without key', async () => {
    type Message = { role: string; content: string };

    type AIState = {
      chatId: string;
      messages: Array<Message>;
    };

    const initialState: AIState = {
      chatId: '123',
      messages: [],
    };

    await withAIState({ state: initialState, options: {} }, async () => {
      // Test with getMutableState()
      const stateWithoutKey = getMutableAIState();

      stateWithoutKey.update((current: AIState) => ({
        ...current,
        messages: [...current.messages, { role: 'user', content: 'Hello!' }],
      }));

      stateWithoutKey.done((current: AIState) => ({
        ...current,
        messages: [
          ...current.messages,
          { role: 'assistant', content: 'Hello! How can I assist you today?' },
        ],
      }));

      const deltaWithoutKey = await getAIStateDeltaPromise();
      expect(deltaWithoutKey).toBeDefined();
      expect(getAIState()).toEqual({
        chatId: '123',
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hello! How can I assist you today?' },
        ],
      });
    });

    await withAIState({ state: initialState, options: {} }, async () => {
      // Test with getMutableState('messages')
      const stateWithKey = getMutableAIState('messages');

      stateWithKey.update((current: Array<Message>) => [
        ...current,
        { role: 'user', content: 'Hello!' },
      ]);

      stateWithKey.done((current: Array<Message>) => [
        ...current,
        { role: 'assistant', content: 'Hello! How can I assist you today?' },
      ]);

      const deltaWithKey = await getAIStateDeltaPromise();
      expect(deltaWithKey).toBeDefined();
      expect(getAIState()).toEqual({
        chatId: '123',
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hello! How can I assist you today?' },
        ],
      });
    });
  });
});
