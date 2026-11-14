import { appendFileSync, mkdirSync } from 'node:fs';
import type { Telemetry } from 'ai';
import type { HarnessDiagnostic, HarnessDiagnosticConsumer } from './types';

/**
 * A harness observability reporter that writes a unified, non-lossy
 * `events.jsonl` containing **both** the telemetry span lifecycle (turn / step
 * / tool) **and** the forwarded bridge diagnostics (console lines + structured
 * events). It is a single object registered in `telemetry.integrations`: the
 * framework drives its `Telemetry` methods for spans and calls
 * `ingestDiagnostic` for diagnostics.
 *
 * No external collector or OTel setup required — this is the AI-SDK-idiomatic
 * replacement for the original SDK's host-side artifact files.
 */
export interface FileReporterOptions {
  /** Directory for `events.jsonl` (created if absent). */
  dir: string;
  /**
   * Buffer a turn's records in memory and write them only if the turn produced
   * an error (an `error`-level diagnostic, a failed tool, or an error finish).
   * Default false (write everything).
   */
  failOnly?: boolean;
  /** File name within `dir`. Default `events.jsonl`. */
  fileName?: string;
}

type Record_ = { ts: number } & Record<string, unknown>;

export type FileReporter = Telemetry & HarnessDiagnosticConsumer;

export function createFileReporter(options: FileReporterOptions): FileReporter {
  const fileName = options.fileName ?? 'events.jsonl';
  const path = `${options.dir}/${fileName}`;
  const failOnly = options.failOnly ?? false;

  // Per-turn buffers, keyed by the telemetry callId. Diagnostics (which carry a
  // sessionId, not a callId) attach to the most recently started, open turn.
  const turns = new Map<string, { lines: Record_[]; errored: boolean }>();
  let lastOpenCallId: string | undefined;
  let dirReady = false;

  const bucketFor = (callId: string) => {
    let bucket = turns.get(callId);
    if (!bucket) {
      bucket = { lines: [], errored: false };
      turns.set(callId, bucket);
    }
    return bucket;
  };

  const record = (callId: string | undefined, rec: Record_): void => {
    const id = callId ?? lastOpenCallId;
    if (id == null) {
      // No active turn — write standalone (best-effort).
      flushLines([rec]);
      return;
    }
    bucketFor(id).lines.push(rec);
  };

  const flushLines = (lines: Record_[]): void => {
    if (lines.length === 0) return;
    try {
      if (!dirReady) {
        mkdirSync(options.dir, { recursive: true });
        dirReady = true;
      }
      appendFileSync(path, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
    } catch {
      // Best-effort: never let observability break a turn.
    }
  };

  const finishTurn = (callId: string): void => {
    const bucket = turns.get(callId);
    if (!bucket) return;
    turns.delete(callId);
    if (lastOpenCallId === callId) lastOpenCallId = undefined;
    if (failOnly && !bucket.errored) return;
    flushLines(bucket.lines);
  };

  return {
    onStart(event) {
      const e = event as {
        callId: string;
        operationId?: string;
        modelId?: string;
        provider?: string;
        messages?: unknown;
        instructions?: unknown;
        recordInputs?: boolean;
      };
      lastOpenCallId = e.callId;
      record(e.callId, {
        ts: Date.now(),
        kind: 'turn-start',
        callId: e.callId,
        operationId: e.operationId,
        provider: e.provider,
        modelId: e.modelId,
        // Input prompt, unless the consumer opted out via `recordInputs: false`.
        ...(e.recordInputs === false
          ? {}
          : { input: { messages: e.messages, instructions: e.instructions } }),
      });
    },
    onStepStart(event) {
      const e = event as { callId: string; stepNumber?: number };
      record(e.callId, {
        ts: Date.now(),
        kind: 'step-start',
        callId: e.callId,
        step: e.stepNumber,
      });
    },
    onToolExecutionStart(event) {
      const e = event as {
        callId: string;
        toolCall: { toolName: string; toolCallId: string; input: unknown };
      };
      record(e.callId, {
        ts: Date.now(),
        kind: 'tool-start',
        callId: e.callId,
        toolName: e.toolCall.toolName,
        toolCallId: e.toolCall.toolCallId,
        input: e.toolCall.input,
      });
    },
    onToolExecutionEnd(event) {
      const e = event as {
        callId: string;
        toolCall: { toolCallId: string };
        toolOutput: { type: string; output?: unknown; error?: unknown };
      };
      const isError = e.toolOutput.type === 'error';
      if (isError) bucketFor(e.callId).errored = true;
      record(e.callId, {
        ts: Date.now(),
        kind: 'tool-end',
        callId: e.callId,
        toolCallId: e.toolCall.toolCallId,
        isError,
        output: isError ? e.toolOutput.error : e.toolOutput.output,
      });
    },
    onStepFinish(event) {
      const e = event as {
        callId: string;
        usage?: unknown;
        content?: unknown[];
        recordOutputs?: boolean;
      };
      record(e.callId, {
        ts: Date.now(),
        kind: 'step-finish',
        callId: e.callId,
        usage: e.usage,
        // The model's output content, unless `recordOutputs: false`.
        ...(e.recordOutputs === false || e.content == null
          ? {}
          : { output: e.content }),
      });
    },
    onEnd(event) {
      const e = event as {
        callId: string;
        finishReason?: unknown;
        usage?: unknown;
        totalUsage?: unknown;
      };
      record(e.callId, {
        ts: Date.now(),
        kind: 'turn-finish',
        callId: e.callId,
        finishReason: e.finishReason,
        usage: e.totalUsage ?? e.usage,
      });
      finishTurn(e.callId);
    },
    onError(error) {
      if (lastOpenCallId != null) bucketFor(lastOpenCallId).errored = true;
      record(lastOpenCallId, {
        ts: Date.now(),
        kind: 'error',
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
    },
    ingestDiagnostic(diagnostic: HarnessDiagnostic) {
      if (diagnostic.level === 'error' && lastOpenCallId != null) {
        bucketFor(lastOpenCallId).errored = true;
      }
      record(lastOpenCallId, {
        ts: diagnostic.timestamp,
        kind: 'diagnostic',
        diagnostic,
      });
    },
  };
}
