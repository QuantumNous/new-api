import { convertXaiChatUsage } from './convert-xai-chat-usage';
import { describe, it, expect } from 'vitest';

describe('convertXaiChatUsage', () => {
  it('should convert basic usage without reasoning tokens', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 12,
      completion_tokens: 1,
      total_tokens: 13,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 12,
          "total": 12,
        },
        "outputTokens": {
          "reasoning": 0,
          "text": 1,
          "total": 1,
        },
        "raw": {
          "completion_tokens": 1,
          "prompt_tokens": 12,
          "total_tokens": 13,
        },
      }
    `);
  });

  it('should convert usage with reasoning tokens (xai reports separately)', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 12,
      completion_tokens: 1,
      total_tokens: 241,
      completion_tokens_details: {
        reasoning_tokens: 228,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 12,
          "total": 12,
        },
        "outputTokens": {
          "reasoning": 228,
          "text": 1,
          "total": 229,
        },
        "raw": {
          "completion_tokens": 1,
          "completion_tokens_details": {
            "reasoning_tokens": 228,
          },
          "prompt_tokens": 12,
          "total_tokens": 241,
        },
      }
    `);
  });

  it('should convert usage with cached input tokens', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 12,
      completion_tokens: 2,
      total_tokens: 438,
      prompt_tokens_details: {
        text_tokens: 12,
        audio_tokens: 0,
        image_tokens: 0,
        cached_tokens: 3,
      },
      completion_tokens_details: {
        reasoning_tokens: 424,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 3,
          "cacheWrite": undefined,
          "noCache": 9,
          "total": 12,
        },
        "outputTokens": {
          "reasoning": 424,
          "text": 2,
          "total": 426,
        },
        "raw": {
          "completion_tokens": 2,
          "completion_tokens_details": {
            "reasoning_tokens": 424,
          },
          "prompt_tokens": 12,
          "prompt_tokens_details": {
            "audio_tokens": 0,
            "cached_tokens": 3,
            "image_tokens": 0,
            "text_tokens": 12,
          },
          "total_tokens": 438,
        },
      }
    `);
  });

  it('should handle cached_tokens exceeding prompt_tokens (non-inclusive reporting)', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 4142,
      completion_tokens: 254,
      total_tokens: 8724,
      prompt_tokens_details: {
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

  it('should handle null token details', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300,
      prompt_tokens_details: null,
      completion_tokens_details: null,
    });

    expect(result.inputTokens.cacheRead).toMatchInlineSnapshot(`0`);
    expect(result.inputTokens.noCache).toMatchInlineSnapshot(`100`);
    expect(result.outputTokens.reasoning).toMatchInlineSnapshot(`0`);
    expect(result.outputTokens.text).toMatchInlineSnapshot(`200`);
    expect(result.outputTokens.total).toMatchInlineSnapshot(`200`);
  });

  it('should handle zero reasoning tokens', () => {
    const result = convertXaiChatUsage({
      prompt_tokens: 50,
      completion_tokens: 100,
      total_tokens: 150,
      completion_tokens_details: {
        reasoning_tokens: 0,
      },
    });

    expect(result.outputTokens).toMatchInlineSnapshot(`
      {
        "reasoning": 0,
        "text": 100,
        "total": 100,
      }
    `);
  });

  it('should preserve raw usage data', () => {
    const rawUsage = {
      prompt_tokens: 12,
      completion_tokens: 2,
      total_tokens: 331,
      prompt_tokens_details: {
        text_tokens: 12,
        audio_tokens: 0,
        image_tokens: 0,
        cached_tokens: 2,
      },
      completion_tokens_details: {
        reasoning_tokens: 317,
        audio_tokens: 0,
        accepted_prediction_tokens: 0,
        rejected_prediction_tokens: 0,
      },
    };

    const result = convertXaiChatUsage(rawUsage);

    expect(result.raw).toEqual(rawUsage);
  });
});
