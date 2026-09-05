import {
  safeParseJSON,
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { harnessV1BridgeReadySchema } from '../v1/harness-v1-bridge-protocol';

const bridgeMetaSchema = z.object({
  type: z.string().optional(),
  port: z.number().optional(),
  state: z.string().optional(),
  pid: z.number().optional(),
});

export type BridgeReadySource = 'stdout' | 'metadata';

export type BridgeReadyErrorContext = {
  proc: Experimental_SandboxProcess;
  stdoutTail: string[];
};

export type WaitForBridgeReadyOptions = {
  proc: Experimental_SandboxProcess;
  sandbox: Experimental_SandboxSession;
  bridgeStateDir: string;
  bridgeType: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
  createTimeoutError?: (
    context: BridgeReadyErrorContext,
  ) => Error | Promise<Error>;
  createExitError?: (
    context: BridgeReadyErrorContext,
  ) => Error | Promise<Error>;
};

export type WaitForBridgeReadyResult = {
  port: number;
  source: BridgeReadySource;
  stdoutTail: string[];
};

export async function markBridgeStarting({
  sandbox,
  bridgeStateDir,
  bridgeType,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  bridgeStateDir: string;
  bridgeType: string;
  abortSignal?: AbortSignal;
}): Promise<void> {
  try {
    await sandbox.writeTextFile({
      path: bridgeMetaPath(bridgeStateDir),
      content: JSON.stringify({ type: bridgeType, state: 'starting' }),
      abortSignal,
    });
  } catch {
    /*
     * The bridge's own metadata writes are best-effort. This host-side marker
     * only prevents stale readiness fallback when possible; stdout remains the
     * primary readiness signal.
     */
  }
}

export async function waitForBridgeReady({
  proc,
  sandbox,
  bridgeStateDir,
  bridgeType,
  timeoutMs,
  abortSignal,
  pollIntervalMs = 100,
  createTimeoutError,
  createExitError,
}: WaitForBridgeReadyOptions): Promise<WaitForBridgeReadyResult> {
  const reader = proc.stdout.pipeThrough(new TextDecoderStream()).getReader();
  const decoder = lineDecoder();
  const stdoutTail: string[] = [];
  const deadline = Date.now() + timeoutMs;
  let pendingStdoutRead: Promise<ReadableStreamReadResult<string>> | undefined;
  let pendingMetaRead: Promise<number | undefined> | undefined;
  let nextMetaReadAt = 0;
  let cancelReader = false;

  try {
    while (true) {
      if (abortSignal?.aborted) {
        cancelReader = true;
        await proc.kill();
        throw abortSignal.reason ?? new DOMException('Aborted', 'AbortError');
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        cancelReader = true;
        await proc.kill();
        throw await makeBridgeReadyError({
          createError: createTimeoutError,
          fallbackMessage: 'bridge did not become ready in time.',
          proc,
          stdoutTail,
        });
      }

      pendingStdoutRead ??= reader.read();
      const metaReadDelayMs = Math.max(0, nextMetaReadAt - Date.now());
      if (pendingMetaRead === undefined && metaReadDelayMs === 0) {
        pendingMetaRead = readBridgeMetaReady({
          sandbox,
          bridgeStateDir,
          bridgeType,
          abortSignal,
        });
      }

      const result = await Promise.race([
        pendingStdoutRead.then(read => ({ source: 'stdout' as const, read })),
        ...(pendingMetaRead === undefined
          ? []
          : [
              pendingMetaRead.then(port => ({
                source: 'metadata' as const,
                port,
              })),
            ]),
        sleep(
          Math.min(
            remaining,
            pendingMetaRead === undefined ? metaReadDelayMs : pollIntervalMs,
          ),
        ).then(() => undefined),
      ]);

      if (result === undefined) continue;

      if (result.source === 'metadata') {
        pendingMetaRead = undefined;
        if (result.port !== undefined) {
          cancelReader = true;
          return {
            port: result.port,
            source: 'metadata',
            stdoutTail: [...stdoutTail],
          };
        }
        nextMetaReadAt = Date.now() + pollIntervalMs;
        continue;
      }

      pendingStdoutRead = undefined;
      const { value, done } = result.read;
      if (done) {
        for (const line of decoder.flush()) {
          pushTail({ lines: stdoutTail, line });
        }
        throw await makeBridgeReadyError({
          createError: createExitError,
          fallbackMessage: 'bridge exited before becoming ready.',
          proc,
          stdoutTail,
        });
      }
      if (value === undefined) continue;
      for (const line of decoder.push(value)) {
        pushTail({ lines: stdoutTail, line });
        const parsed = await safeParseJSON({
          text: line,
          schema: harnessV1BridgeReadySchema,
        });
        if (parsed.success) {
          return {
            port: parsed.value.port,
            source: 'stdout',
            stdoutTail: [...stdoutTail],
          };
        }
      }
    }
  } finally {
    if (cancelReader) {
      await Promise.race([reader.cancel().catch(() => {}), sleep(100)]);
    }
    try {
      reader.releaseLock();
    } catch {}
  }
}

async function readBridgeMetaReady({
  sandbox,
  bridgeStateDir,
  bridgeType,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  bridgeStateDir: string;
  bridgeType: string;
  abortSignal?: AbortSignal;
}): Promise<number | undefined> {
  const raw = await Promise.resolve(
    sandbox.readTextFile({
      path: bridgeMetaPath(bridgeStateDir),
      abortSignal,
    }),
  ).catch(() => null);
  if (raw == null) return undefined;

  const parsed = await safeParseJSON({ text: raw, schema: bridgeMetaSchema });
  if (!parsed.success) return undefined;
  if (parsed.value.type !== bridgeType) return undefined;
  if (parsed.value.state !== 'waiting') return undefined;
  if (parsed.value.port === undefined || parsed.value.port <= 0) {
    return undefined;
  }
  return parsed.value.port;
}

async function makeBridgeReadyError({
  createError,
  fallbackMessage,
  proc,
  stdoutTail,
}: {
  createError:
    | ((context: BridgeReadyErrorContext) => Error | Promise<Error>)
    | undefined;
  fallbackMessage: string;
  proc: Experimental_SandboxProcess;
  stdoutTail: string[];
}): Promise<Error> {
  if (createError) {
    return createError({ proc, stdoutTail: [...stdoutTail] });
  }
  return new Error(fallbackMessage);
}

function bridgeMetaPath(bridgeStateDir: string): string {
  return `${bridgeStateDir}/bridge-meta.json`;
}

function pushTail({ lines, line }: { lines: string[]; line: string }): void {
  lines.push(line);
  if (lines.length > 20) lines.shift();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
