import { describe, expect, it } from 'vitest';
import {
  TerminalFrameBuffer,
  type TerminalFrameOutput,
} from './terminal-frame-buffer';

describe('TerminalFrameBuffer', () => {
  it('paints the first frame as a full refresh', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('one\ntwo');

    expect(output.text()).toBe('\x1b[H\x1b[2Jone\ntwo');
  });

  it('updates only changed lines after the first frame', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('one\ntwo\nthree');
    buffer.present('one\nchanged\nthree');

    expect(output.chunks.at(-1)).toBe('\x1b[2;1H\x1b[2Kchanged');
  });

  it('does not write when the frame has not changed', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('same');
    buffer.present('same');

    expect(output.chunks).toEqual(['\x1b[H\x1b[2Jsame']);
  });

  it('clears lines left behind by a shorter frame', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('one\ntwo\nthree');
    buffer.present('one');

    expect(output.chunks.at(-1)).toBe('\x1b[2;1H\x1b[2K\x1b[3;1H\x1b[2K');
  });

  it('fully repaints after external writes move the cursor', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('one\ntwo');
    output.write('external\n');
    buffer.present('one\nchanged');

    expect(output.chunks.at(-1)).toBe('\x1b[H\x1b[2Jone\nchanged');
  });

  it('wraps writes in synchronized update markers by default', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output);

    buffer.present('frame');

    expect(output.text()).toBe('\x1b[?2026h\x1b[H\x1b[2Jframe\x1b[?2026l');
  });

  it('preserves callbacks on external writes', () => {
    const output = createOutput();
    new TerminalFrameBuffer(output, { useSynchronizedUpdates: false });
    let callbackCalled = false;

    output.write('external', () => {
      callbackCalled = true;
    });

    expect(callbackCalled).toBe(true);
  });

  it('resets the previous frame', () => {
    const output = createOutput();
    const buffer = new TerminalFrameBuffer(output, {
      useSynchronizedUpdates: false,
    });

    buffer.present('one');
    buffer.reset();
    buffer.present('one');

    expect(output.chunks).toEqual(['\x1b[H\x1b[2Jone', '\x1b[H\x1b[2Jone']);
  });
});

function createOutput() {
  const chunks: string[] = [];
  const output: TerminalFrameOutput & {
    chunks: string[];
    text: () => string;
  } = {
    chunks,
    write(chunk, encodingOrCallback) {
      chunks.push(String(chunk));
      if (typeof encodingOrCallback === 'function') {
        encodingOrCallback();
      }
      return true;
    },
    text() {
      return chunks.join('');
    },
  };

  return output;
}
