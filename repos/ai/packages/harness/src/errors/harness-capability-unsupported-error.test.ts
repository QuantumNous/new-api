import { describe, expect, test } from 'vitest';
import { HarnessCapabilityUnsupportedError } from './harness-capability-unsupported-error';
import { HarnessError } from './harness-error';

describe('HarnessCapabilityUnsupportedError', () => {
  test('is a HarnessError', () => {
    const err = new HarnessCapabilityUnsupportedError({
      message: 'Harness does not support manual compaction',
    });
    expect(HarnessError.isInstance(err)).toBe(true);
    expect(HarnessCapabilityUnsupportedError.isInstance(err)).toBe(true);
  });

  test('preserves the supplied message and harnessId', () => {
    const err = new HarnessCapabilityUnsupportedError({
      message: 'Claude Code does not support tool approvals',
      harnessId: 'claude-code',
    });
    expect(err.message).toBe('Claude Code does not support tool approvals');
    expect(err.harnessId).toBe('claude-code');
  });

  test('preserves cause', () => {
    const cause = new Error('inner');
    const err = new HarnessCapabilityUnsupportedError({
      message: 'sandbox cannot spawn',
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  test('isInstance returns false for unrelated errors', () => {
    expect(HarnessCapabilityUnsupportedError.isInstance(new Error('x'))).toBe(
      false,
    );
    expect(HarnessCapabilityUnsupportedError.isInstance(null)).toBe(false);
  });
});
