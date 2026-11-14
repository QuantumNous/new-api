import { describe, expect, it } from 'vitest';
import {
  extractAssistantText,
  getPiTerminalError,
  parseNativeEvent,
} from './pi-events';

describe('parseNativeEvent', () => {
  it('parses a well-formed event', () => {
    const event = parseNativeEvent({ type: 'turn_start' });
    expect(event?.type).toBe('turn_start');
  });

  it('passes unknown fields through', () => {
    const event = parseNativeEvent({ type: 'custom', extra: { nested: true } });
    expect(event).toMatchObject({ type: 'custom', extra: { nested: true } });
  });

  it('returns undefined for malformed input', () => {
    expect(parseNativeEvent(null)).toBeUndefined();
    expect(parseNativeEvent({})).toBeUndefined();
    expect(parseNativeEvent({ type: 42 })).toBeUndefined();
  });
});

describe('getPiTerminalError', () => {
  it('extracts a string error', () => {
    expect(getPiTerminalError({ type: 'x', error: 'boom' } as never)).toBe(
      'boom',
    );
  });

  it('extracts error.errorMessage', () => {
    expect(
      getPiTerminalError({
        type: 'x',
        error: { errorMessage: 'oops' },
      } as never),
    ).toBe('oops');
  });

  it('returns stopReason when it is error/aborted', () => {
    expect(
      getPiTerminalError({
        type: 'x',
        error: { stopReason: 'error' },
      } as never),
    ).toBe('error');
    expect(
      getPiTerminalError({
        type: 'x',
        error: { stopReason: 'aborted' },
      } as never),
    ).toBe('aborted');
  });

  it('ignores non-terminal stopReasons', () => {
    expect(
      getPiTerminalError({
        type: 'x',
        error: { stopReason: 'tool_use' },
      } as never),
    ).toBeUndefined();
  });

  it('extracts message.errorMessage', () => {
    expect(
      getPiTerminalError({
        type: 'x',
        message: { errorMessage: 'msg' },
      } as never),
    ).toBe('msg');
  });

  it('extracts isError + content', () => {
    expect(
      getPiTerminalError({
        type: 'x',
        isError: true,
        content: 'failed',
      } as never),
    ).toBe('failed');
  });

  it('returns undefined for normal events', () => {
    expect(getPiTerminalError({ type: 'text_delta' } as never)).toBeUndefined();
  });
});

describe('extractAssistantText', () => {
  it('returns "" when no message', () => {
    expect(extractAssistantText(undefined)).toBe('');
  });

  it('returns "" for non-assistant messages', () => {
    expect(extractAssistantText({ role: 'user', content: 'hi' } as never)).toBe(
      '',
    );
  });

  it('returns string content directly', () => {
    expect(
      extractAssistantText({ role: 'assistant', content: 'hello' } as never),
    ).toBe('hello');
  });

  it('concatenates text parts from array content', () => {
    expect(
      extractAssistantText({
        role: 'assistant',
        content: [
          { type: 'text', text: 'one' },
          { type: 'tool_use', name: 'bash' },
          { type: 'text', text: 'two' },
        ],
      } as never),
    ).toBe('onetwo');
  });
});
