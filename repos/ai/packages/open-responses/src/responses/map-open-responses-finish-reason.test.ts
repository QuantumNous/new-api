import { describe, expect, it } from 'vitest';
import { mapOpenResponsesFinishReason } from './map-open-responses-finish-reason';

describe('mapOpenResponsesFinishReason', () => {
  it('should return tool-calls when hasToolCalls is true and finishReason is undefined', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: undefined,
        hasToolCalls: true,
      }),
    ).toBe('tool-calls');
  });

  it('should return tool-calls when hasToolCalls is true and finishReason is null', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: null,
        hasToolCalls: true,
      }),
    ).toBe('tool-calls');
  });

  it('should return stop when hasToolCalls is false and finishReason is undefined', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: undefined,
        hasToolCalls: false,
      }),
    ).toBe('stop');
  });

  it('should return stop when hasToolCalls is false and finishReason is null', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: null,
        hasToolCalls: false,
      }),
    ).toBe('stop');
  });

  it('should return length when finishReason is max_output_tokens', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: 'max_output_tokens',
        hasToolCalls: false,
      }),
    ).toBe('length');
  });

  it('should return content-filter when finishReason is content_filter', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: 'content_filter',
        hasToolCalls: false,
      }),
    ).toBe('content-filter');
  });

  it('should return tool-calls when hasToolCalls is true and finishReason is unknown', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: 'completed',
        hasToolCalls: true,
      }),
    ).toBe('tool-calls');
  });

  it('should return other when hasToolCalls is false and finishReason is unknown', () => {
    expect(
      mapOpenResponsesFinishReason({
        finishReason: 'completed',
        hasToolCalls: false,
      }),
    ).toBe('other');
  });
});
