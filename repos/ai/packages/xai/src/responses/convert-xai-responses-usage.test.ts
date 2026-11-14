import { convertXaiResponsesUsage } from './convert-xai-responses-usage';
import { describe, it, expect } from 'vitest';

describe('convertXaiResponsesUsage', () => {
  it('should convert basic usage without caching or reasoning', () => {
    const result = convertXaiResponsesUsage({
      input_tokens: 100,
      output_tokens: 50,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 100,
          "total": 100,
        },
        "outputTokens": {
          "reasoning": 0,
          "text": 50,
          "total": 50,
        },
        "raw": {
          "input_tokens": 100,
          "output_tokens": 50,
        },
      }
    `);
  });

  it('should convert usage with reasoning tokens', () => {
    const result = convertXaiResponsesUsage({
      input_tokens: 1941,
      output_tokens: 583,
      total_tokens: 2524,
      output_tokens_details: {
        reasoning_tokens: 380,
      },
    });

    expect(result.outputTokens).toMatchInlineSnapshot(`
      {
        "reasoning": 380,
        "text": 203,
        "total": 583,
      }
    `);
  });

  it('should convert usage with cached input tokens', () => {
    const result = convertXaiResponsesUsage({
      input_tokens: 200,
      output_tokens: 50,
      input_tokens_details: {
        cached_tokens: 150,
      },
    });

    expect(result.inputTokens).toMatchInlineSnapshot(`
      {
        "cacheRead": 150,
        "cacheWrite": undefined,
        "noCache": 50,
        "total": 200,
      }
    `);
  });

  it('should handle cached_tokens exceeding input_tokens (non-inclusive reporting)', () => {
    const result = convertXaiResponsesUsage({
      input_tokens: 4142,
      output_tokens: 254,
      input_tokens_details: {
        cached_tokens: 4328,
      },
    });

    expect(result.inputTokens).toMatchInlineSnapshot(`
      {
        "cacheRead": 4328,
        "cacheWrite": undefined,
        "noCache": 4142,
        "total": 8470,
      }
    `);
  });

  it('should convert usage with both cached input and reasoning', () => {
    const result = convertXaiResponsesUsage({
      input_tokens: 200,
      output_tokens: 583,
      input_tokens_details: {
        cached_tokens: 150,
      },
      output_tokens_details: {
        reasoning_tokens: 380,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 150,
          "cacheWrite": undefined,
          "noCache": 50,
          "total": 200,
        },
        "outputTokens": {
          "reasoning": 380,
          "text": 203,
          "total": 583,
        },
        "raw": {
          "input_tokens": 200,
          "input_tokens_details": {
            "cached_tokens": 150,
          },
          "output_tokens": 583,
          "output_tokens_details": {
            "reasoning_tokens": 380,
          },
        },
      }
    `);
  });

  it('should preserve raw usage data', () => {
    const rawUsage = {
      input_tokens: 12,
      output_tokens: 319,
      total_tokens: 331,
      input_tokens_details: {
        cached_tokens: 2,
      },
      output_tokens_details: {
        reasoning_tokens: 317,
      },
    };

    const result = convertXaiResponsesUsage(rawUsage);

    expect(result.raw).toEqual(rawUsage);
  });
});
