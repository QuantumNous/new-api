export type TerminalFrameOutput = {
  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean;
};

export type TerminalFrameBufferOptions = {
  useSynchronizedUpdates?: boolean;
};

const escape = '\x1b';
const cursorHome = `${escape}[H`;
const clearScreen = `${escape}[2J`;
const clearLine = `${escape}[2K`;
const synchronizeStart = `${escape}[?2026h`;
const synchronizeEnd = `${escape}[?2026l`;

type FrameSnapshot = {
  lines: string[];
};

export class TerminalFrameBuffer {
  readonly #useSynchronizedUpdates: boolean;
  readonly #originalWrite: TerminalFrameOutput['write'];

  #previousFrame?: FrameSnapshot;
  #isWritingFrame = false;
  #externalWriteSinceLastFrame = false;

  constructor(
    output: TerminalFrameOutput,
    options?: TerminalFrameBufferOptions,
  ) {
    this.#originalWrite = output.write.bind(output);
    this.#useSynchronizedUpdates = options?.useSynchronizedUpdates ?? true;

    output.write = ((
      chunk: string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      if (!this.#isWritingFrame) {
        this.#externalWriteSinceLastFrame = true;
      }

      return this.#originalWrite(chunk, encodingOrCallback, callback);
    }) as TerminalFrameOutput['write'];
  }

  present(frame: string) {
    const nextFrame = snapshotFrame(frame);
    const update =
      this.#previousFrame && !this.#externalWriteSinceLastFrame
        ? diffFrame(this.#previousFrame, nextFrame)
        : `${cursorHome}${clearScreen}${frame}`;

    this.#previousFrame = nextFrame;
    this.#externalWriteSinceLastFrame = false;

    if (update.length === 0) {
      return;
    }

    this.#writeUpdate(update);
  }

  reset() {
    this.#previousFrame = undefined;
  }

  #writeUpdate(update: string) {
    this.#isWritingFrame = true;

    try {
      if (!this.#useSynchronizedUpdates) {
        this.#originalWrite(update);
        return;
      }

      this.#originalWrite(`${synchronizeStart}${update}${synchronizeEnd}`);
    } finally {
      this.#isWritingFrame = false;
    }
  }
}

function snapshotFrame(frame: string): FrameSnapshot {
  return { lines: frame.split('\n') };
}

function diffFrame(previousFrame: FrameSnapshot, nextFrame: FrameSnapshot) {
  let output = '';
  const lineCount = Math.max(
    previousFrame.lines.length,
    nextFrame.lines.length,
  );

  for (let index = 0; index < lineCount; index++) {
    const line = nextFrame.lines[index];

    if (previousFrame.lines[index] === line) {
      continue;
    }

    output += `${escape}[${index + 1};1H${clearLine}${line ?? ''}`;
  }

  return output;
}
