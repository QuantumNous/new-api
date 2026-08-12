import { describe, expect, it } from 'vitest';
import {
  emitMissingFinalDelta,
  getOpenCodeEventSessionId,
  isStepSettlementEvent,
  unwrapOpenCodeEvent,
} from './opencode-events';

describe('OpenCode event helpers', () => {
  it('unwraps native v2 events with data payloads', () => {
    const event = unwrapOpenCodeEvent({
      id: 'event-1',
      type: 'session.next.step.ended',
      data: {
        sessionID: 'session-1',
        finish: 'stop',
      },
    });

    expect(event).toEqual({
      id: 'event-1',
      type: 'session.next.step.ended',
      properties: {
        sessionID: 'session-1',
        finish: 'stop',
      },
    });
    expect(getOpenCodeEventSessionId(event!)).toBe('session-1');
    expect(isStepSettlementEvent(event!)).toBe(true);
  });

  it('unwraps synchronized events and strips version suffixes', () => {
    const event = unwrapOpenCodeEvent({
      type: 'sync',
      id: 'outer-event',
      syncEvent: {
        id: 'sync-event',
        type: 'session.next.text.ended.1',
        data: {
          sessionID: 'session-1',
          textID: 'text-1',
          text: 'done',
        },
      },
    });

    expect(event).toEqual({
      id: 'sync-event',
      type: 'session.next.text.ended',
      properties: {
        sessionID: 'session-1',
        textID: 'text-1',
        text: 'done',
      },
    });
  });

  it('finds legacy tool part session ids', () => {
    expect(
      getOpenCodeEventSessionId({
        type: 'message.part.updated',
        properties: {
          part: {
            type: 'tool',
            sessionID: 'session-1',
          },
        },
      }),
    ).toBe('session-1');
  });

  it('emits only the final text that has not already streamed', () => {
    const emitted: Record<string, unknown>[] = [];

    emitMissingFinalDelta({
      id: 'text-1',
      fullText: 'hello world',
      emittedText: 'hello ',
      emit: msg => emitted.push(msg),
      type: 'text-delta',
    });
    emitMissingFinalDelta({
      id: 'text-1',
      fullText: 'hello world',
      emittedText: 'hello world',
      emit: msg => emitted.push(msg),
      type: 'text-delta',
    });
    emitMissingFinalDelta({
      id: 'text-1',
      fullText: 'rewritten',
      emittedText: 'hello',
      emit: msg => emitted.push(msg),
      type: 'text-delta',
    });

    expect(emitted).toEqual([
      { type: 'text-delta', id: 'text-1', delta: 'world' },
    ]);
  });
});
