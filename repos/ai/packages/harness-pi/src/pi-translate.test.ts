import { describe, expect, it } from 'vitest';
import type { PiSessionEvent } from './pi-events';
import {
  createPiTranslatorState,
  translatePiEvent,
  type PiTranslatorState,
} from './pi-translate';

function emit(events: PiSessionEvent[], state: PiTranslatorState) {
  return events.flatMap(e => translatePiEvent(e, state));
}

describe('translatePiEvent', () => {
  it('drops events before turn_start', () => {
    const state = createPiTranslatorState();
    const out = translatePiEvent(
      {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta: 'hi' },
      } as PiSessionEvent,
      state,
    );
    expect(out).toEqual([]);
  });

  it('emits text-start before the first text-delta', () => {
    const state = createPiTranslatorState();
    const out = emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'Hello ' },
        } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'world' },
        } as PiSessionEvent,
      ],
      state,
    );
    expect(out[0]?.type).toBe('text-start');
    const id = (out[0] as { id: string }).id;
    expect(out[1]).toMatchObject({ type: 'text-delta', id, delta: 'Hello ' });
    expect(out[2]).toMatchObject({ type: 'text-delta', id, delta: 'world' });
  });

  it('gap-fills missing text at turn_end and emits text-end', () => {
    const state = createPiTranslatorState();
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'partial' },
        } as PiSessionEvent,
      ],
      state,
    );
    const closing = translatePiEvent(
      {
        type: 'turn_end',
        message: { role: 'assistant', content: 'partial and more' },
      } as PiSessionEvent,
      state,
    );
    // gap-fill delta then text-end
    expect(closing[0]).toMatchObject({
      type: 'text-delta',
      delta: ' and more',
    });
    expect(closing[1]?.type).toBe('text-end');
  });

  it('emits text-end without gap-fill when nothing is missing', () => {
    const state = createPiTranslatorState();
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'complete' },
        } as PiSessionEvent,
      ],
      state,
    );
    const closing = translatePiEvent(
      {
        type: 'message_end',
        message: { role: 'assistant', content: 'complete' },
      } as PiSessionEvent,
      state,
    );
    expect(closing.find(p => p.type === 'text-delta')).toBeUndefined();
    expect(closing.find(p => p.type === 'text-end')).toBeDefined();
  });

  it('emits reasoning-start lazily on first thinking_delta', () => {
    const state = createPiTranslatorState();
    const out = emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: {
            type: 'thinking_delta',
            delta: 'pondering...',
          },
        } as PiSessionEvent,
      ],
      state,
    );
    expect(out[0]?.type).toBe('reasoning-start');
    expect(out[1]).toMatchObject({
      type: 'reasoning-delta',
      delta: 'pondering...',
    });
  });

  it('emits reasoning-end on turn_end if reasoning was started', () => {
    const state = createPiTranslatorState();
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'thinking_delta', delta: 'think' },
        } as PiSessionEvent,
      ],
      state,
    );
    const closing = translatePiEvent(
      {
        type: 'turn_end',
        message: { role: 'assistant', content: '' },
      } as PiSessionEvent,
      state,
    );
    expect(closing.find(p => p.type === 'reasoning-end')).toBeDefined();
  });

  it('emits tool-call with providerExecuted=true for builtin tools', () => {
    const state = createPiTranslatorState({
      builtinToolNames: ['bash'],
    });
    emit([{ type: 'turn_start' } as PiSessionEvent], state);
    const out = translatePiEvent(
      {
        type: 'tool_execution_start',
        toolCallId: 'call_1',
        toolName: 'bash',
        args: { command: 'ls' },
      } as PiSessionEvent,
      state,
    );
    expect(out[0]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName: 'bash',
      input: JSON.stringify({ command: 'ls' }),
      providerExecuted: true,
    });
  });

  it('uses common name as wire toolName when nativeToCommon contains it', () => {
    const state = createPiTranslatorState({
      builtinToolNames: ['find'],
      nativeToCommon: { find: 'glob' },
    });
    emit([{ type: 'turn_start' } as PiSessionEvent], state);
    const out = translatePiEvent(
      {
        type: 'tool_execution_start',
        toolCallId: 'c2',
        toolName: 'find',
        args: { pattern: '*.ts' },
      } as PiSessionEvent,
      state,
    );
    expect(out[0]).toMatchObject({
      type: 'tool-call',
      toolName: 'glob',
      nativeName: 'find',
      providerExecuted: true,
    });
  });

  it('emits tool-call with providerExecuted unset for user-registered tools', () => {
    const state = createPiTranslatorState({ builtinToolNames: ['bash'] });
    emit([{ type: 'turn_start' } as PiSessionEvent], state);
    const out = translatePiEvent(
      {
        type: 'tool_execution_start',
        toolCallId: 'c3',
        toolName: 'deploy',
        args: { env: 'staging' },
      } as PiSessionEvent,
      state,
    );
    const part = out[0] as { providerExecuted?: boolean };
    expect(part.providerExecuted).toBeUndefined();
  });

  it('correlates tool-result with the prior tool-call by id', () => {
    const state = createPiTranslatorState({
      builtinToolNames: ['bash'],
    });
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'tool_execution_start',
          toolCallId: 'c4',
          toolName: 'bash',
          args: { command: 'echo' },
        } as PiSessionEvent,
      ],
      state,
    );
    const out = translatePiEvent(
      {
        type: 'tool_execution_end',
        toolCallId: 'c4',
        result: 'hello',
      } as PiSessionEvent,
      state,
    );
    expect(out[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'c4',
      toolName: 'bash',
      result: 'hello',
    });
  });

  it('surfaces the original host-submitted output object instead of the echoed text', () => {
    const state = createPiTranslatorState();
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'tool_execution_start',
          toolCallId: 'c6',
          toolName: 'weather',
          args: { city: 'SF' },
        } as PiSessionEvent,
      ],
      state,
    );

    // The session records the exact value the host submitted; Pi echoes only
    // the serialized text back on the result event.
    const submitted = { state: 'ready', temperature: 72, weather: 'sunny' };
    state.hostToolResults.set('c6', submitted);

    const out = translatePiEvent(
      {
        type: 'tool_execution_end',
        toolCallId: 'c6',
        result: {
          content: [{ type: 'text', text: JSON.stringify(submitted) }],
        },
      } as PiSessionEvent,
      state,
    );

    expect(out[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'c6',
      toolName: 'weather',
      result: submitted,
    });
    // The stored value is consumed so it cannot leak into a later result.
    expect(state.hostToolResults.has('c6')).toBe(false);
  });

  it('marks tool-result as error when isError is true', () => {
    const state = createPiTranslatorState();
    emit(
      [
        { type: 'turn_start' } as PiSessionEvent,
        {
          type: 'tool_execution_start',
          toolCallId: 'c5',
          toolName: 'bash',
          args: {},
        } as PiSessionEvent,
      ],
      state,
    );
    const out = translatePiEvent(
      {
        type: 'tool_execution_end',
        toolCallId: 'c5',
        result: 'boom',
        isError: true,
      } as PiSessionEvent,
      state,
    );
    expect(out[0]).toMatchObject({ type: 'tool-result', isError: true });
  });

  it('drops unrecognised event types', () => {
    const state = createPiTranslatorState();
    emit([{ type: 'turn_start' } as PiSessionEvent], state);
    expect(
      translatePiEvent({ type: 'queue_update' } as PiSessionEvent, state),
    ).toEqual([]);
  });

  it('translates compaction_end into a compaction part (auto for threshold/overflow)', () => {
    const state = createPiTranslatorState();
    const out = translatePiEvent(
      {
        type: 'compaction_end',
        reason: 'threshold',
        aborted: false,
        result: { summary: 'Condensed history.', tokensBefore: 90000 },
      } as PiSessionEvent,
      state,
    );
    expect(out).toEqual([
      {
        type: 'compaction',
        trigger: 'auto',
        summary: 'Condensed history.',
        tokensBefore: 90000,
      },
    ]);
  });

  it('maps reason "manual" to trigger "manual"', () => {
    const state = createPiTranslatorState();
    const out = translatePiEvent(
      {
        type: 'compaction_end',
        reason: 'manual',
        aborted: false,
        result: { summary: 'Manual compaction.' },
      } as PiSessionEvent,
      state,
    );
    expect(out[0]).toEqual({
      type: 'compaction',
      trigger: 'manual',
      summary: 'Manual compaction.',
    });
  });

  it('drops aborted or result-less compaction_end events', () => {
    const state = createPiTranslatorState();
    expect(
      translatePiEvent(
        {
          type: 'compaction_end',
          reason: 'manual',
          aborted: true,
          result: { summary: 's' },
        } as PiSessionEvent,
        state,
      ),
    ).toEqual([]);
    expect(
      translatePiEvent(
        {
          type: 'compaction_end',
          reason: 'overflow',
          aborted: false,
        } as PiSessionEvent,
        state,
      ),
    ).toEqual([]);
  });

  it('emits with a placeholder summary when the result has no summary', () => {
    const state = createPiTranslatorState();
    const out = translatePiEvent(
      {
        type: 'compaction_end',
        reason: 'threshold',
        aborted: false,
        result: { tokensBefore: 50000 },
      } as PiSessionEvent,
      state,
    );
    expect(out).toEqual([
      {
        type: 'compaction',
        trigger: 'auto',
        summary: '(no summary provided)',
        tokensBefore: 50000,
      },
    ]);
  });
});
