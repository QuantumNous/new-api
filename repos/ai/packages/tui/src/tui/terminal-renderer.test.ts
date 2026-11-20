import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  parseKey,
  TerminalRenderer,
  type TerminalInput,
  type TerminalOutput,
} from './terminal-renderer';
import type { TerminalFrameBuffer } from './terminal-frame-buffer';
import { stripAnsi } from './layout';
import type { AgentTUIStreamResult } from '../agent-tui-runner';
import type { UIMessageChunk } from 'ai';

type TestInput = TerminalInput &
  EventEmitter & {
    rawModes: boolean[];
    resumeCalls: number;
    pauseCalls: number;
  };

type TestOutput = TerminalOutput &
  EventEmitter & {
    chunks: string[];
    text: () => string;
  };

type TestFrameBuffer = TerminalFrameBuffer & {
  text: () => string;
  lastPresentedText: () => string;
};

describe('parseKey', () => {
  it('decodes terminal control keys', () => {
    expect(parseKey(Buffer.from('\x1B[A'))).toEqual({ type: 'up' });
    expect(parseKey(Buffer.from('\x1B[B'))).toEqual({ type: 'down' });
    expect(parseKey(Buffer.from('\x1B[5~'))).toEqual({ type: 'page-up' });
    expect(parseKey(Buffer.from('\x1B[6~'))).toEqual({ type: 'page-down' });
    expect(parseKey(Buffer.from('\u007f'))).toEqual({ type: 'backspace' });
    expect(parseKey(Buffer.from('\r'))).toEqual({ type: 'enter' });
    expect(parseKey(Buffer.from('\u000c'))).toEqual({ type: 'ctrl-l' });
    expect(parseKey(Buffer.from('\u0003'))).toEqual({ type: 'ctrl-c' });
    expect(parseKey(Buffer.from('\x1B'))).toEqual({ type: 'escape' });
  });

  it('keeps printable input as character data', () => {
    expect(parseKey(Buffer.from('hello'))).toEqual({
      type: 'character',
      value: 'hello',
    });
  });
});

describe('TerminalRenderer', () => {
  it('reads a prompt from the pinned input box', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });
    const promptPromise = renderer.readPrompt({ title: 'Test' });

    input.emit('data', Buffer.from('hi'));
    input.emit('data', Buffer.from('\r'));

    await expect(promptPromise).resolves.toBe('hi');
    expect(stripAnsi(output.text())).toContain('┌ Input ');
    expect(stripAnsi(output.text())).toContain('│ > hi█');
    expect(stripAnsi(output.text())).toContain('╭ User ');
  });

  it('streams assistant text with output tokens per second by default', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(
      createStream(['# Hello', '\n- there'], {
        outputTokens: 12,
        outputTokensPerSecond: 12.25,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    expect(output.text()).toContain('\x1b[92m╭ Assistant ');
    expect(stripAnsi(output.text())).toContain('12.3 tok/s');
    expect(stripAnsi(output.text())).toContain('│ │ █ Hello');
    expect(stripAnsi(output.text())).toContain('│ │ • there');
    expect(input.rawModes).toEqual([true, false]);
  });

  it('shows most recent call total tokens in the outer frame', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(
      createStream(['hello'], {
        inputTokens: 3,
        outputTokens: 12,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    expect(stripAnsi(output.text())).toContain(
      '┌ Test ───────────────────── 15 tokens ┐',
    );
  });

  it('shows context window percentage with total tokens in the outer frame', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output, contextSize: 60 });

    await renderer.renderStream(
      createStream(['hello'], {
        inputTokens: 3,
        outputTokens: 12,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    expect(stripAnsi(output.text())).toContain(
      '┌ Test ───────────────── 15 tokens 25% ┐',
    );
  });

  it('streams assistant text with token count when configured', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({
      input,
      output,
      responseStatistics: 'outputTokenCount',
    });

    await renderer.renderStream(
      createStream(['hello'], {
        outputTokens: 12,
        outputTokensPerSecond: 12.25,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    const rendered = stripAnsi(output.text());

    expect(rendered).toContain('12 tokens');
    expect(rendered).not.toContain('12.3 tok/s');
  });

  it('renders submitted prompts as user cards before assistant output', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(createStream(['hello']) as never, {
      title: 'Test',
      submittedPrompt: 'what now?',
      waitForExit: false,
    });

    expect(output.text()).toContain('\x1b[96m╭ User ');
    expect(stripAnsi(output.text())).toContain('what now?');
  });

  it('keeps processing status until the first visible assistant chunk arrives', async () => {
    const input = createInput();
    const output = createOutput();
    const nextChunk = createDeferred<void>();
    const renderer = new TerminalRenderer({ input, output });
    const renderPromise = renderer.renderStream(
      createDelayedTextStream(nextChunk.promise) as never,
      {
        title: 'Test',
        submittedPrompt: 'what now?',
        waitForExit: false,
      },
    );

    await Promise.resolve();
    expect(stripAnsi(output.text())).toContain('Processing input...');
    expect(stripAnsi(output.text())).not.toContain('Streaming...');

    nextChunk.resolve();
    await renderPromise;

    expect(stripAnsi(output.text())).toContain('Streaming...');
  });

  it('only follows new output while already scrolled to the bottom', async () => {
    const input = createInput();
    const output = createOutput();
    const frameBuffer = createFrameBuffer();
    const secondChunk = createDeferred<void>();
    const secondChunkConsumed = createDeferred<void>();
    const thirdChunk = createDeferred<void>();
    output.rows = 10;
    const renderer = new TerminalRenderer({ input, output, frameBuffer });
    const renderPromise = renderer.renderStream(
      createPausedTextStream({
        firstText: 'one\ntwo\nthree\nfour\nfive',
        secondText: '\nsix\nseven',
        thirdText: '\neight',
        secondChunk: secondChunk.promise,
        onSecondChunkConsumed: secondChunkConsumed.resolve,
        thirdChunk: thirdChunk.promise,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    await waitForFrameText(frameBuffer, 'five');
    input.emit('data', Buffer.from('\x1B[A'));
    await waitForFrameText(frameBuffer, 'three');

    secondChunk.resolve();
    await secondChunkConsumed.promise;

    const scrolledFrame = stripAnsi(frameBuffer.text());
    expect(scrolledFrame).toContain('three');
    expect(scrolledFrame).toContain('five');
    expect(scrolledFrame).not.toContain('seven');

    input.emit('data', Buffer.from('\x1B[B'));
    input.emit('data', Buffer.from('\x1B[B'));
    input.emit('data', Buffer.from('\x1B[B'));
    await waitForFrameText(frameBuffer, 'seven');

    thirdChunk.resolve();
    await renderPromise;

    const bottomFrame = stripAnsi(frameBuffer.lastPresentedText());
    expect(bottomFrame).toContain('eight');
    expect(bottomFrame).not.toContain('three');
  });

  it('shows tool execution and tool-result processing statuses before streaming', async () => {
    const input = createInput();
    const output = createOutput();
    const toolFinished = createDeferred<void>();
    const nextTextStarted = createDeferred<void>();
    const nextStepRendered = createDeferred<void>();
    const renderer = new TerminalRenderer({ input, output });
    const renderPromise = renderer.renderStream(
      createPausedToolStream({
        toolFinished: toolFinished.promise,
        onNextStepStarted: nextStepRendered.resolve,
        nextTextStarted: nextTextStarted.promise,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );
    const initialChunkCount = output.chunks.length;

    await waitForOutputTextAfter(
      output,
      initialChunkCount,
      'Executing tools...',
    );
    expect(
      stripAnsi(output.chunks.slice(initialChunkCount).join('')),
    ).not.toContain('Streaming...');

    const beforeToolFinishedChunkCount = output.chunks.length;
    toolFinished.resolve();
    await waitForOutputTextAfter(
      output,
      beforeToolFinishedChunkCount,
      'Processing tool results...',
    );

    await nextStepRendered.promise;
    const beforeNextTextChunkCount = output.chunks.length;
    nextTextStarted.resolve();
    await renderPromise;
    await waitForOutputTextAfter(
      output,
      beforeNextTextChunkCount,
      'Streaming...',
    );
  });

  it('renders reasoning and tool parts as distinct colored cards', async () => {
    const input = createInput();
    const output = createOutput();
    output.rows = 20;
    const renderer = new TerminalRenderer({
      tools: 'full',
      reasoning: 'full',
      input,
      output,
    });

    await renderer.renderStream(createMixedStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    expect(output.text()).toContain('\x1b[94m╭ Reasoning ');
    expect(output.text()).toContain('\x1b[95m╭ Tool · weather ');
    expect(stripAnsi(output.text())).toMatch(/╭ Tool · weather ─+ executing ╮/);
    expect(stripAnsi(output.text())).toMatch(/╭ Tool · weather ─+ done ╮/);
    expect(stripAnsi(output.text())).toContain('thinking');
    expect(stripAnsi(output.text())).toContain('Input:');
    expect(stripAnsi(output.text())).toContain('Output:');
    expect(stripAnsi(output.text())).toContain('"weather": "sunny"');
  });

  it('does not render empty reasoning parts', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(createEmptyReasoningStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).not.toContain('Reasoning');
    expect(rendered).toContain('Hello');
  });

  it('renders tool approval statuses in the tool header', async () => {
    const input = createInput();
    const output = createOutput();
    output.columns = 64;
    output.rows = 20;
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(createToolApprovalStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).toMatch(/╭ Tool · shell ─+ waiting ╮/);
    expect(rendered).toMatch(/╭ Tool · shell ─+ approval requested ╮/);
    expect(rendered).toMatch(/╭ Tool · shell ─+ denied ╮/);
  });

  it('collapses tool parts to an empty box with name and status', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({
      tools: 'collapsed',
      input,
      output,
    });

    await renderer.renderStream(createMixedStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).toMatch(/╭ Tool · weather ─+ executing ╮/);
    expect(rendered).toMatch(/╭ Tool · weather ─+ done ╮/);
    expect(rendered).toMatch(/╰─+╯/);
    expect(rendered).not.toContain('Input:');
    expect(rendered).not.toContain('Output:');
    expect(rendered).not.toContain('"weather": "sunny"');
  });

  it('auto-collapses tool parts by default after a later visible part is shown', async () => {
    const input = createInput();
    const output = createOutput();
    const frameBuffer = createFrameBuffer();
    output.rows = 20;
    const nextTextStarted = createDeferred<void>();
    const renderer = new TerminalRenderer({
      input,
      output,
      frameBuffer,
    });
    const renderPromise = renderer.renderStream(
      createToolThenTextStream({
        nextTextStarted: nextTextStarted.promise,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    await waitForFrameText(frameBuffer, 'Output:');
    expect(stripAnsi(frameBuffer.text())).toContain('"weather": "sunny"');

    nextTextStarted.resolve();
    await renderPromise;

    const rendered = stripAnsi(frameBuffer.lastPresentedText());
    expect(rendered).toContain('Tool · weather');
    expect(rendered).toContain('hello');
    expect(rendered).not.toContain('Input:');
    expect(rendered).not.toContain('Output:');
    expect(rendered).not.toContain('"weather": "sunny"');
  });

  it('keeps auto-collapsed tool parts expanded when later parts are hidden', async () => {
    const input = createInput();
    const output = createOutput();
    output.rows = 20;
    const renderer = new TerminalRenderer({
      tools: 'auto-collapsed',
      reasoning: 'hidden',
      input,
      output,
    });

    await renderer.renderStream(createToolThenReasoningStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());
    expect(rendered).toContain('Tool · weather');
    expect(rendered).toContain('Output:');
    expect(rendered).toContain('"weather": "sunny"');
    expect(rendered).not.toContain('Reasoning');
    expect(rendered).not.toContain('thinking');
  });

  it('hides tool parts', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ tools: 'hidden', input, output });

    await renderer.renderStream(createMixedStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).not.toContain('Tool · weather');
    expect(rendered).not.toContain('Input:');
    expect(rendered).not.toContain('Output:');
    expect(rendered).not.toContain('"weather": "sunny"');
    expect(rendered).toContain('thinking');
  });

  it('collapses reasoning parts to an empty box', async () => {
    const input = createInput();
    const output = createOutput();
    output.rows = 20;
    const renderer = new TerminalRenderer({
      reasoning: 'collapsed',
      input,
      output,
    });

    await renderer.renderStream(createMixedStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).toMatch(/╭ Reasoning ·+╮/);
    expect(rendered).toMatch(/╰·+╯/);
    expect(rendered).not.toContain('thinking');
    expect(rendered).toContain('Tool · weather');
  });

  it('auto-collapses reasoning parts by default after a later visible part is shown', async () => {
    const input = createInput();
    const output = createOutput();
    const frameBuffer = createFrameBuffer();
    output.rows = 20;
    const nextToolStarted = createDeferred<void>();
    const renderer = new TerminalRenderer({
      input,
      output,
      frameBuffer,
    });
    const renderPromise = renderer.renderStream(
      createReasoningThenToolStream({
        nextToolStarted: nextToolStarted.promise,
      }) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    await waitForFrameText(frameBuffer, 'thinking');

    nextToolStarted.resolve();
    await renderPromise;

    const rendered = stripAnsi(frameBuffer.lastPresentedText());
    expect(rendered).toContain('Reasoning');
    expect(rendered).not.toContain('thinking');
    expect(rendered).toContain('Tool · weather');
    expect(rendered).toContain('Input:');
  });

  it('hides reasoning parts', async () => {
    const input = createInput();
    const output = createOutput();
    output.rows = 20;
    const renderer = new TerminalRenderer({
      reasoning: 'hidden',
      input,
      output,
    });

    await renderer.renderStream(createMixedStream() as never, {
      title: 'Test',
      waitForExit: false,
    });

    const rendered = stripAnsi(output.text());

    expect(rendered).not.toContain('Reasoning');
    expect(rendered).not.toContain('thinking');
    expect(rendered).toContain('Tool · weather');
  });

  it('renders stream errors into the body box', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(
      createErrorStream(new Error('Bad API key')) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    expect(output.text()).toContain('\x1b[91m╭ Error ');
    expect(output.text()).toContain('Bad API key');
  });

  it('interrupts streaming immediately while waiting for the next chunk', async () => {
    const input = createInput();
    const output = createOutput();
    const abort = createDeferred<void>();
    const started = createDeferred<void>();
    const renderer = new TerminalRenderer({ input, output });
    const renderPromise = renderer.renderStream(
      createWaitingStream(started.resolve, abort.resolve) as never,
      {
        title: 'Test',
        waitForExit: false,
      },
    );

    await started.promise;
    input.emit('data', Buffer.from('\u0003'));

    await expect(renderPromise).rejects.toThrow('Interrupted');
    expect(stripAnsi(output.text())).toContain('Interrupted');
  });

  it('reads tool approval decisions from the status prompt', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });
    const approvalPromise = renderer.readToolApproval(
      {
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
        messageId: 'message-1',
        partIndex: 0,
      },
      { title: 'Test' },
    );

    expect(stripAnsi(output.text())).toContain('Approve tool shell? y/n');

    input.emit('data', Buffer.from('y'));

    await expect(approvalPromise).resolves.toEqual({ approved: true });
    expect(stripAnsi(output.text())).toContain('Approved');
  });

  it('denies tool approval decisions from the status prompt', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });
    const approvalPromise = renderer.readToolApproval(
      {
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
        messageId: 'message-1',
        partIndex: 0,
      },
      { title: 'Test' },
    );

    input.emit('data', Buffer.from('n'));

    await expect(approvalPromise).resolves.toEqual({
      approved: false,
      reason: 'Denied by user.',
    });
    expect(stripAnsi(output.text())).toContain('Denied');
  });

  it('keeps the terminal session open between turns', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });

    await renderer.renderStream(createStream(['hello']) as never, {
      title: 'Test',
      continueSession: true,
      waitForExit: false,
    });

    expect(output.text()).toContain('Done · Enter another prompt');
    expect(input.rawModes).toEqual([true]);

    const promptPromise = renderer.readPrompt({ title: 'Test' });
    input.emit('data', Buffer.from('next'));
    input.emit('data', Buffer.from('\r'));

    await expect(promptPromise).resolves.toBe('next');
    expect(stripAnsi(output.text())).toContain('│ > next█');
  });

  it('fully repaints unchanged lines on resize', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });
    const promptPromise = renderer.readPrompt({ title: 'Test' });

    output.emit('resize');

    expect(output.chunks.at(-1)).toContain('\x1b[H\x1b[2J');
    expect(stripAnsi(output.chunks.at(-1) ?? '')).toContain('┌ Test ');

    input.emit('data', Buffer.from('\r'));
    await expect(promptPromise).resolves.toBe('');
  });

  it('fully repaints unchanged lines when Ctrl+L is pressed', async () => {
    const input = createInput();
    const output = createOutput();
    const renderer = new TerminalRenderer({ input, output });
    const promptPromise = renderer.readPrompt({ title: 'Test' });

    input.emit('data', Buffer.from('\u000c'));

    expect(output.chunks.at(-1)).toContain('\x1b[H\x1b[2J');
    expect(stripAnsi(output.chunks.at(-1) ?? '')).toContain('┌ Test ');

    input.emit('data', Buffer.from('\r'));
    await expect(promptPromise).resolves.toBe('');
  });
});

function createInput() {
  const input = new EventEmitter() as TestInput;

  input.isTTY = true;
  input.rawModes = [];
  input.resumeCalls = 0;
  input.pauseCalls = 0;
  input.setRawMode = mode => {
    input.rawModes.push(mode);
    return input;
  };
  input.resume = () => {
    input.resumeCalls += 1;
    return input;
  };
  input.pause = () => {
    input.pauseCalls += 1;
    return input;
  };

  return input;
}

function createOutput() {
  const chunks: string[] = [];
  const output = new EventEmitter() as TestOutput;

  output.columns = 40;
  output.rows = 10;
  output.chunks = chunks;
  output.write = (chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  };
  output.text = () => chunks.join('');

  return output;
}

function createFrameBuffer() {
  let frame = '';
  let lastPresentedFrame = '';

  return {
    present(nextFrame: string) {
      frame = nextFrame;
      lastPresentedFrame = nextFrame;
    },
    reset() {
      frame = '';
    },
    text() {
      return frame;
    },
    lastPresentedText() {
      return lastPresentedFrame;
    },
  } as TestFrameBuffer;
}

async function waitForOutputTextAfter(
  output: TestOutput,
  chunkIndex: number,
  text: string,
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rendered = stripAnsi(output.chunks.slice(chunkIndex).join(''));

    if (rendered.includes(text)) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  expect(stripAnsi(output.chunks.slice(chunkIndex).join(''))).toContain(text);
}

async function waitForFrameText(frameBuffer: TestFrameBuffer, text: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rendered = stripAnsi(frameBuffer.text());

    if (rendered.includes(text)) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  expect(stripAnsi(frameBuffer.text())).toContain(text);
}

function createPausedTextStream({
  firstText,
  secondText,
  thirdText,
  secondChunk,
  onSecondChunkConsumed,
  thirdChunk,
}: {
  firstText: string;
  secondText: string;
  thirdText: string;
  secondChunk: Promise<void>;
  onSecondChunkConsumed?: () => void;
  thirdChunk: Promise<void>;
}): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: firstText };
      await secondChunk;
      yield { type: 'text-delta', id: 'text-1', delta: secondText };
      onSecondChunkConsumed?.();
      await thirdChunk;
      yield { type: 'text-delta', id: 'text-1', delta: thirdText };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createStream(
  chunks: string[],
  stats?: {
    inputTokens?: number;
    outputTokens: number;
    outputTokensPerSecond?: number;
  },
): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield { type: 'text-start', id: 'text-1' };
      for (const text of chunks) {
        yield { type: 'text-delta', id: 'text-1', delta: text };
      }
      yield { type: 'text-end', id: 'text-1' };
      yield {
        type: 'finish',
        usage:
          stats == null
            ? undefined
            : {
                ...(stats.inputTokens == null
                  ? {}
                  : { inputTokens: stats.inputTokens }),
                outputTokens: stats.outputTokens,
              },
        messageMetadata:
          stats?.outputTokensPerSecond == null
            ? undefined
            : {
                performance: {
                  outputTokensPerSecond: stats.outputTokensPerSecond,
                },
              },
      };
    })(),
  };
}

function createDelayedTextStream(
  nextChunk: Promise<void>,
): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      await nextChunk;
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: 'hello' };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createMixedStream(): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield { type: 'reasoning-start', id: 'reasoning-1' };
      yield { type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' };
      yield { type: 'reasoning-end', id: 'reasoning-1' };
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { city: 'Berlin', weather: 'sunny' },
      } satisfies UIMessageChunk;
      yield { type: 'finish' };
    })(),
  };
}

function createToolThenTextStream({
  nextTextStarted,
}: {
  nextTextStarted: Promise<void>;
}): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { city: 'Berlin', weather: 'sunny' },
      } satisfies UIMessageChunk;
      await nextTextStarted;
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: 'hello' };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createToolThenReasoningStream(): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { city: 'Berlin', weather: 'sunny' },
      } satisfies UIMessageChunk;
      yield { type: 'reasoning-start', id: 'reasoning-1' };
      yield { type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' };
      yield { type: 'reasoning-end', id: 'reasoning-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createReasoningThenToolStream({
  nextToolStarted,
}: {
  nextToolStarted: Promise<void>;
}): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield { type: 'reasoning-start', id: 'reasoning-1' };
      yield { type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' };
      yield { type: 'reasoning-end', id: 'reasoning-1' };
      await nextToolStarted;
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
      } satisfies UIMessageChunk;
      yield { type: 'finish' };
    })(),
  };
}

function createEmptyReasoningStream(): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield { type: 'reasoning-start', id: 'reasoning-1' };
      yield { type: 'reasoning-end', id: 'reasoning-1' };
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: 'Hello' };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createToolApprovalStream(): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield {
        type: 'tool-input-start',
        toolCallId: 'call-1',
        toolName: 'shell',
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-approval-request',
        approvalId: 'approval-1',
        toolCallId: 'call-1',
      } satisfies UIMessageChunk;
      yield {
        type: 'tool-approval-response',
        approvalId: 'approval-1',
        approved: false,
        reason: 'Denied by user.',
      } satisfies UIMessageChunk;
      yield { type: 'finish' };
    })(),
  };
}

function createPausedToolStream({
  toolFinished,
  onNextStepStarted,
  nextTextStarted,
}: {
  toolFinished: Promise<void>;
  onNextStepStarted: () => void;
  nextTextStarted: Promise<void>;
}): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield { type: 'start', messageId: 'message-1' };
      yield {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
      } satisfies UIMessageChunk;
      await toolFinished;
      yield {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { city: 'Berlin', weather: 'sunny' },
      } satisfies UIMessageChunk;
      yield { type: 'start-step' };
      onNextStepStarted();
      await nextTextStarted;
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: 'hello' };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish' };
    })(),
  };
}

function createErrorStream(error: unknown): AgentTUIStreamResult {
  return {
    uiMessageStream: (async function* () {
      yield {
        type: 'error',
        errorText: error instanceof Error ? error.message : String(error),
      };
    })(),
  };
}

function createWaitingStream(
  onStart: () => void,
  onAbort: () => void,
): AgentTUIStreamResult {
  return {
    uiMessageStream: new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'message-1' });
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: { city: 'Berlin' },
        });
        onStart();
      },
      cancel: onAbort,
    }),
    abort: onAbort,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
