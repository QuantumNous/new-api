import { describe, expect, it } from 'vitest';
import { mapGoogleInteractionsFinishReason } from './map-google-interactions-finish-reason';

describe('mapGoogleInteractionsFinishReason', () => {
  it('maps "completed" without function_call to "stop"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'completed',
        hasFunctionCall: false,
      }),
    ).toBe('stop');
  });

  it('maps "completed" with function_call to "tool-calls"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'completed',
        hasFunctionCall: true,
      }),
    ).toBe('tool-calls');
  });

  it('maps "requires_action" to "tool-calls"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'requires_action',
        hasFunctionCall: false,
      }),
    ).toBe('tool-calls');
  });

  it('maps "failed" to "error"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'failed',
        hasFunctionCall: false,
      }),
    ).toBe('error');
  });

  it('maps "incomplete" to "length"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'incomplete',
        hasFunctionCall: false,
      }),
    ).toBe('length');
  });

  it('maps "cancelled" to "other"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'cancelled',
        hasFunctionCall: false,
      }),
    ).toBe('other');
  });

  it('maps "in_progress" / unknown to "other"', () => {
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'in_progress',
        hasFunctionCall: false,
      }),
    ).toBe('other');
    expect(
      mapGoogleInteractionsFinishReason({
        status: 'no-such-status',
        hasFunctionCall: false,
      }),
    ).toBe('other');
    expect(
      mapGoogleInteractionsFinishReason({
        status: undefined,
        hasFunctionCall: false,
      }),
    ).toBe('other');
  });
});
