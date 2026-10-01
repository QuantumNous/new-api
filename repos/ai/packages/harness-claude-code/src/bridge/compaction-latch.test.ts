import { describe, expect, it, vi } from 'vitest';
import {
  createCompactionLatch,
  type CompactionEvent,
} from './compaction-latch';

describe('createCompactionLatch', () => {
  it('emits once both halves arrive, boundary first', () => {
    const emit = vi.fn<(e: CompactionEvent) => void>();
    const latch = createCompactionLatch(emit);

    latch.onBoundary({
      trigger: 'auto',
      tokensBefore: 120000,
      tokensAfter: 38000,
    });
    expect(emit).not.toHaveBeenCalled();

    latch.onSummary('Summarized earlier turns.');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      type: 'compaction',
      trigger: 'auto',
      summary: 'Summarized earlier turns.',
      tokensBefore: 120000,
      tokensAfter: 38000,
    });
  });

  it('emits once both halves arrive, summary first', () => {
    const emit = vi.fn<(e: CompactionEvent) => void>();
    const latch = createCompactionLatch(emit);

    latch.onSummary('Summary.');
    expect(emit).not.toHaveBeenCalled();

    latch.onBoundary({ trigger: 'manual' });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      type: 'compaction',
      trigger: 'manual',
      summary: 'Summary.',
    });
  });

  it('omits token fields when the boundary did not report them', () => {
    const emit = vi.fn<(e: CompactionEvent) => void>();
    const latch = createCompactionLatch(emit);
    latch.onBoundary({ trigger: 'auto' });
    latch.onSummary('s');
    expect(emit.mock.calls[0]![0]).toEqual({
      type: 'compaction',
      trigger: 'auto',
      summary: 's',
    });
  });

  it('resets after emitting so a second compaction in the same turn emits again', () => {
    const emit = vi.fn<(e: CompactionEvent) => void>();
    const latch = createCompactionLatch(emit);

    latch.onBoundary({ trigger: 'auto', tokensBefore: 100 });
    latch.onSummary('first');
    latch.onBoundary({ trigger: 'manual', tokensBefore: 200 });
    latch.onSummary('second');

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1]![0]).toEqual({
      type: 'compaction',
      trigger: 'manual',
      summary: 'second',
      tokensBefore: 200,
    });
  });

  it('does not emit on a lone summary or lone boundary', () => {
    const emit = vi.fn<(e: CompactionEvent) => void>();
    const latch = createCompactionLatch(emit);
    latch.onSummary('orphan');
    latch.onBoundary({ trigger: 'auto' });
    // boundary now pairs with the earlier summary → one emit; a second lone
    // boundary stays pending.
    latch.onBoundary({ trigger: 'manual' });
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
