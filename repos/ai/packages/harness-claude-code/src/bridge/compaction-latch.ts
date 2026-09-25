/*
 * Claude reports a compaction in two pieces whose arrival order is not
 * guaranteed: the `compact_boundary` system message (trigger + token counts)
 * and the `PostCompact` hook (the summary text). The harness `compaction`
 * event needs fields from both, so this latch holds each half and emits a
 * single merged event once both have arrived, then resets for the next
 * compaction in the same turn.
 */

export type CompactionBoundary = {
  trigger: 'manual' | 'auto';
  tokensBefore?: number;
  tokensAfter?: number;
};

export type CompactionEvent = {
  type: 'compaction';
  trigger: 'manual' | 'auto';
  summary: string;
  tokensBefore?: number;
  tokensAfter?: number;
};

export type CompactionLatch = {
  onBoundary(boundary: CompactionBoundary): void;
  onSummary(summary: string): void;
};

export function createCompactionLatch(
  emit: (event: CompactionEvent) => void,
): CompactionLatch {
  let boundary: CompactionBoundary | undefined;
  let summary: string | undefined;

  const tryEmit = (): void => {
    if (!boundary || summary === undefined) return;
    emit({
      type: 'compaction',
      trigger: boundary.trigger,
      summary,
      ...(boundary.tokensBefore !== undefined
        ? { tokensBefore: boundary.tokensBefore }
        : {}),
      ...(boundary.tokensAfter !== undefined
        ? { tokensAfter: boundary.tokensAfter }
        : {}),
    });
    boundary = undefined;
    summary = undefined;
  };

  return {
    onBoundary(next) {
      boundary = next;
      tryEmit();
    },
    onSummary(next) {
      summary = next;
      tryEmit();
    },
  };
}
