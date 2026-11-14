import { safeParseJSON } from '@ai-sdk/provider-utils';

/**
 * Recovery rung selected from an on-disk bridge event log when attach is not
 * possible (the bridge process is gone): `'replay'` when the log holds a
 * complete turn the host can resume from its cursor, `'rerun'` otherwise.
 */
export type DiskLogRecoveryMode = 'replay' | 'rerun';

/**
 * Decide whether a respawned bridge can `replay` a turn from its persisted
 * `event-log.ndjson`, or must `rerun` it from scratch.
 *
 * A turn is replayable only when its log ends in a terminal `finish` event —
 * a log that is missing, empty, or ends mid-turn means the bridge died before
 * completing the turn, so there is no coherent tail to deliver and the runtime
 * must re-run it (continuing its own thread from the sandbox snapshot).
 *
 * @param eventLog Raw contents of `event-log.ndjson` (newline-delimited JSON),
 *   or `null`/`undefined`/empty when the file is absent.
 */
export async function classifyDiskLog(
  eventLog: string | null | undefined,
): Promise<DiskLogRecoveryMode> {
  if (!eventLog) return 'rerun';
  const lines = eventLog
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  if (lastLine == null) return 'rerun';

  const parsed = await safeParseJSON({ text: lastLine });
  if (
    parsed.success &&
    parsed.value != null &&
    typeof parsed.value === 'object' &&
    (parsed.value as { type?: unknown }).type === 'finish'
  ) {
    return 'replay';
  }
  return 'rerun';
}
