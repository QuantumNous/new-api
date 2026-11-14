import type { Experimental_SandboxProcess } from '@ai-sdk/provider-utils';

const DEFAULT_TAIL_LIMIT = 20;

type BridgeProcessStreamName = 'stdout' | 'stderr';

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
};

function isSerializedError(error: unknown): error is SerializedError {
  return (
    typeof error === 'object' &&
    error != null &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatBridgeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  if (isSerializedError(error)) {
    return (
      error.stack ?? `${error.name ? `${error.name}: ` : ''}${error.message}`
    );
  }
  return stringifyUnknown(error);
}

function writeToStderr(line: string): void {
  try {
    process.stderr.write(line);
  } catch {}
}

export function logBridgeError({
  harnessId,
  sessionId,
  context,
  error,
  write = writeToStderr,
}: {
  harnessId: string;
  sessionId?: string;
  context?: string;
  error: unknown;
  write?: (line: string) => void;
}): void {
  const prefix = `[harness:${harnessId}:error${
    sessionId ? ` session=${sessionId}` : ''
  }]`;
  const message = context
    ? `${context}: ${formatBridgeError(error)}`
    : formatBridgeError(error);
  for (const line of message.split('\n')) {
    if (line.trim().length > 0) {
      write(`${prefix} ${line}\n`);
    }
  }
}

export function createBridgeErrorHandler({
  harnessId,
  sessionId,
}: {
  harnessId: string;
  sessionId?: string;
}): (event: { type: 'error'; error: unknown }) => void {
  return event => {
    logBridgeError({
      harnessId,
      sessionId,
      context: 'bridge emitted an error frame',
      error: event.error,
    });
  };
}

export async function createBridgeStartupError({
  message,
  proc,
  stdoutTail,
  stderrTail,
  stderrDone,
}: {
  message: string;
  proc: Experimental_SandboxProcess;
  stdoutTail: string[];
  stderrTail: string[];
  stderrDone?: Promise<void>;
}): Promise<Error> {
  if (stderrDone) {
    await Promise.race([stderrDone, sleep(250)]).catch(() => {});
  }

  let exitStatus = '';
  try {
    const result = (await Promise.race([
      proc.wait(),
      sleep(250).then(() => undefined),
    ])) as { exitCode?: number } | undefined;
    if (result?.exitCode !== undefined) {
      exitStatus = ` Exit code: ${result.exitCode}.`;
    }
  } catch {}

  const details: string[] = [];
  if (stdoutTail.length > 0) {
    details.push(`stdout:\n${stdoutTail.join('\n')}`);
  }
  if (stderrTail.length > 0) {
    details.push(`stderr:\n${stderrTail.join('\n')}`);
  }

  return new Error(
    `${message}${exitStatus}${
      details.length > 0 ? `\n\n${details.join('\n\n')}` : ''
    }`,
  );
}

export async function forwardBridgeProcessStream({
  stream,
  streamName,
  source = 'bridge',
  collectTail,
  tailLimit = DEFAULT_TAIL_LIMIT,
}: {
  stream: ReadableStream<Uint8Array>;
  streamName: BridgeProcessStreamName;
  source?: string;
  collectTail?: string[];
  tailLimit?: number;
}): Promise<void> {
  try {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    const decoder = lineDecoder();
    while (true) {
      const { value, done } = await reader.read();
      const lines = done ? decoder.flush() : value ? decoder.push(value) : [];
      for (const line of lines) {
        recordTail({ lines: collectTail, line, limit: tailLimit });
        writeToStderr(`[harness:${source}:${streamName}] ${line}\n`);
      }
      if (done) return;
    }
  } catch {}
}

export async function drainBridgeProcessStream(
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  try {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) return;
    }
  } catch {}
}

function recordTail({
  lines,
  line,
  limit,
}: {
  lines: string[] | undefined;
  line: string;
  limit: number;
}): void {
  if (!lines) return;
  lines.push(line);
  while (lines.length > limit) lines.shift();
}

function lineDecoder() {
  let buffer = '';
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const lines: string[] = [];
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const raw = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const line = raw.replace(/\r$/, '').trim();
        if (line.length > 0) lines.push(line);
      }
      return lines;
    },
    flush(): string[] {
      const line = buffer.replace(/\r$/, '').trim();
      buffer = '';
      return line.length > 0 ? [line] : [];
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
