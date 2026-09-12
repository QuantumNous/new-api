import { describe, expect, it } from 'vitest';
import { classifyDiskLog } from './classify-disk-log';

const line = (obj: Record<string, unknown>): string => JSON.stringify(obj);

describe('classifyDiskLog', () => {
  it('returns rerun for absent logs', async () => {
    expect(await classifyDiskLog(null)).toBe('rerun');
    expect(await classifyDiskLog(undefined)).toBe('rerun');
    expect(await classifyDiskLog('')).toBe('rerun');
    expect(await classifyDiskLog('   \n  \n')).toBe('rerun');
  });

  it('returns replay when the last event is a finish', async () => {
    const log = [
      line({ type: 'text-delta', id: 'm', delta: 'hi', seq: 1 }),
      line({ type: 'finish', seq: 2 }),
    ].join('\n');
    expect(await classifyDiskLog(log)).toBe('replay');
  });

  it('tolerates a trailing newline', async () => {
    const log = `${line({ type: 'finish', seq: 1 })}\n`;
    expect(await classifyDiskLog(log)).toBe('replay');
  });

  it('returns rerun when the turn ended mid-stream (no finish)', async () => {
    const log = [
      line({ type: 'text-delta', id: 'm', delta: 'one', seq: 1 }),
      line({ type: 'text-delta', id: 'm', delta: 'two', seq: 2 }),
    ].join('\n');
    expect(await classifyDiskLog(log)).toBe('rerun');
  });

  it('returns rerun when the last line is a non-finish event', async () => {
    const log = [
      line({ type: 'finish', seq: 1 }),
      line({ type: 'text-delta', id: 'm', delta: 'late', seq: 2 }),
    ].join('\n');
    expect(await classifyDiskLog(log)).toBe('rerun');
  });

  it('returns rerun when the last line is corrupt', async () => {
    const log = `${line({ type: 'finish', seq: 1 })}\n{not json`;
    expect(await classifyDiskLog(log)).toBe('rerun');
  });
});
