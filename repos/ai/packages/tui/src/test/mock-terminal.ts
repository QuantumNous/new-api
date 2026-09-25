import { EventEmitter } from 'node:events';
import type { TerminalInput, TerminalOutput } from '../tui/terminal-renderer';

const ansiControlSequencePattern = new RegExp(
  `^${String.fromCharCode(27)}\\[([0-9?;]*)([ -/]*)([@-~])`,
);

export class MockUserInput extends EventEmitter implements TerminalInput {
  isTTY = true;
  rawModes: boolean[] = [];
  resumeCalls = 0;
  pauseCalls = 0;

  setRawMode(mode: boolean) {
    this.rawModes.push(mode);
    return this;
  }

  resume() {
    this.resumeCalls += 1;
    return this;
  }

  pause() {
    this.pauseCalls += 1;
    return this;
  }

  type(text: string) {
    this.emit('data', Buffer.from(text));
  }

  enter() {
    this.emit('data', Buffer.from('\r'));
  }

  ctrlC() {
    this.emit('data', Buffer.from('\u0003'));
  }
}

export class MockScreen extends EventEmitter implements TerminalOutput {
  columns: number;
  rows: number;
  #rawOutput = '';
  #lines: string[] = [];
  #cursorLine = 0;
  #cursorColumn = 0;
  #waiters: Array<{
    text: string;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor({ columns, rows }: { columns: number; rows: number }) {
    super();
    this.columns = columns;
    this.rows = rows;
  }

  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) {
    const text = String(chunk);
    this.#rawOutput += text;
    this.#apply(text);

    if (typeof encodingOrCallback === 'function') {
      encodingOrCallback();
    }
    callback?.();

    this.#resolveWaiters();
    return true;
  }

  resize(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
    this.emit('resize');
  }

  snapshot() {
    return this.#lines.join('\n');
  }

  rawOutput() {
    return this.#rawOutput;
  }

  async waitForText(
    text: string,
    timeoutMs = 1000,
    getDebugOutput = () => this.snapshot(),
  ) {
    if (this.snapshot().includes(text)) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const waiter = {
        text,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.#waiters = this.#waiters.filter(
            candidate => candidate !== waiter,
          );
          reject(
            new Error(
              `Timed out waiting for screen text: ${text}\n\nScreen:\n${getDebugOutput()}`,
            ),
          );
        }, timeoutMs),
      };
      this.#waiters.push(waiter);
    });
  }

  #resolveWaiters() {
    const snapshot = this.snapshot();

    for (const waiter of this.#waiters.slice()) {
      if (!snapshot.includes(waiter.text)) {
        continue;
      }

      clearTimeout(waiter.timeout);
      this.#waiters = this.#waiters.filter(candidate => candidate !== waiter);
      waiter.resolve();
    }
  }

  #apply(input: string) {
    let index = 0;

    while (index < input.length) {
      if (input[index] === '\x1b') {
        const nextIndex = this.#applyEscape(input, index);

        if (nextIndex > index) {
          index = nextIndex;
          continue;
        }
      }

      const character = input[index];
      index += 1;

      if (character === undefined) {
        continue;
      }

      if (character === '\n') {
        this.#cursorLine += 1;
        this.#cursorColumn = 0;
        continue;
      }

      if (character === '\r') {
        this.#cursorColumn = 0;
        continue;
      }

      this.#writeCharacter(character);
    }
  }

  #applyEscape(input: string, startIndex: number) {
    const match = input.slice(startIndex).match(ansiControlSequencePattern);

    if (!match) {
      return startIndex;
    }

    const [sequence, rawParameters, , command] = match;
    const parameters = rawParameters ? rawParameters.split(';') : [];

    if (command === 'H' && parameters.length === 0) {
      this.#cursorLine = 0;
      this.#cursorColumn = 0;
    } else if (command === 'J' && parameters[0] === '2') {
      this.#lines = [];
    } else if (command === 'K' && parameters[0] === '2') {
      this.#lines[this.#cursorLine] = '';
      this.#cursorColumn = 0;
    } else if (command === 'H') {
      this.#cursorLine = Number(parameters[0] ?? 1) - 1;
      this.#cursorColumn = Number(parameters[1] ?? 1) - 1;
    }

    return startIndex + sequence.length;
  }

  #writeCharacter(character: string) {
    const line = this.#lines[this.#cursorLine] ?? '';
    const nextLine =
      line.slice(0, this.#cursorColumn) +
      character +
      line.slice(this.#cursorColumn + character.length);
    this.#lines[this.#cursorLine] = nextLine;
    this.#cursorColumn += character.length;
  }
}
