import { describe, expect, it } from 'vitest';
import {
  createInitialRealtimeState,
  RealtimeEventReducer,
} from './realtime-event-reducer';

describe('RealtimeEventReducer', () => {
  it('assembles streamed text into UI messages', async () => {
    const reducer = new RealtimeEventReducer();
    let state = createInitialRealtimeState();

    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'text-delta',
      responseId: 'response-1',
      itemId: 'item-1',
      delta: 'Hel',
      raw: {},
    }));
    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'text-delta',
      responseId: 'response-1',
      itemId: 'item-1',
      delta: 'lo',
      raw: {},
    }));
    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'text-done',
      responseId: 'response-1',
      itemId: 'item-1',
      text: 'Hello',
      raw: {},
    }));

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('assistant');
    expect(state.messages[0].parts).toEqual([
      { type: 'text', text: 'Hello', state: 'done' },
    ]);
  });

  it('keeps tool names available when adding tool output', async () => {
    const reducer = new RealtimeEventReducer();
    let state = createInitialRealtimeState();

    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'function-call-arguments-delta',
      responseId: 'response-1',
      itemId: 'item-1',
      callId: 'call-1',
      delta: '{"city":"Paris"}',
      raw: {},
    }));

    const result = await reducer.reduceServerEvent(state, {
      type: 'function-call-arguments-done',
      responseId: 'response-1',
      itemId: 'item-1',
      callId: 'call-1',
      name: 'getWeather',
      arguments: '{"city":"Paris"}',
      raw: {},
    });

    expect(result.effects).toContainEqual({
      type: 'tool-call',
      callId: 'call-1',
      name: 'getWeather',
      args: { city: 'Paris' },
      rawArguments: '{"city":"Paris"}',
    });

    const output = reducer.addToolOutput(result.state, 'call-1', {
      temperature: 22,
    });

    expect(output.output).toEqual({
      callId: 'call-1',
      name: 'getWeather',
      output: '{"temperature":22}',
    });
    expect(output.state.messages[0].parts).toMatchObject([
      {
        type: 'dynamic-tool',
        toolName: 'getWeather',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { city: 'Paris' },
        output: { temperature: 22 },
      },
    ]);
  });

  it('inserts delayed input transcriptions before the assistant response', async () => {
    const reducer = new RealtimeEventReducer();
    let state = createInitialRealtimeState();

    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'audio-committed',
      itemId: 'user-item-1',
      raw: {},
    }));
    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'text-delta',
      responseId: 'response-1',
      itemId: 'assistant-item-1',
      delta: 'Yes, I can hear you.',
      raw: {},
    }));
    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'text-done',
      responseId: 'response-1',
      itemId: 'assistant-item-1',
      text: 'Yes, I can hear you.',
      raw: {},
    }));
    ({ state } = await reducer.reduceServerEvent(state, {
      type: 'input-transcription-completed',
      itemId: 'user-item-1',
      transcript: 'Can you hear me?',
      raw: {},
    }));

    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toMatchObject({
      id: 'user-user-item-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Can you hear me?', state: 'done' }],
    });
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: 'Yes, I can hear you.', state: 'done' }],
    });
  });
});
