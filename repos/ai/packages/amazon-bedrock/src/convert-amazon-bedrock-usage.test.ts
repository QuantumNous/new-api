import { convertAmazonBedrockUsage } from './convert-amazon-bedrock-usage';
import { describe, it, expect } from 'vitest';

describe('convertAmazonBedrockUsage', () => {
  it('should convert basic usage without cache tokens', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 100,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
      raw: {
        inputTokens: 100,
        outputTokens: 50,
      },
    });
  });

  it('should convert usage with cache read tokens', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 80,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 180, // 100 + 80 + 0
        noCache: 100,
        cacheRead: 80,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
      raw: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 80,
      },
    });
  });

  it('should convert usage with cache write tokens', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
      cacheWriteInputTokens: 60,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 160, // 100 + 0 + 60
        noCache: 100,
        cacheRead: 0,
        cacheWrite: 60,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
      raw: {
        inputTokens: 100,
        outputTokens: 50,
        cacheWriteInputTokens: 60,
      },
    });
  });

  it('should convert usage with both cache read and write tokens', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 80,
      cacheWriteInputTokens: 60,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 240, // 100 + 80 + 60
        noCache: 100,
        cacheRead: 80,
        cacheWrite: 60,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
      raw: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 80,
        cacheWriteInputTokens: 60,
      },
    });
  });

  it('should handle null cache tokens', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: null,
      cacheWriteInputTokens: null,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 100,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
      raw: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: null,
        cacheWriteInputTokens: null,
      },
    });
  });

  it('should handle null usage', () => {
    const result = convertAmazonBedrockUsage(null);

    expect(result).toEqual({
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    });
  });

  it('should handle undefined usage', () => {
    const result = convertAmazonBedrockUsage(undefined);

    expect(result).toEqual({
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    });
  });

  it('should include totalTokens in raw when provided', () => {
    const result = convertAmazonBedrockUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    expect(result.raw).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it('should preserve raw usage data', () => {
    const rawUsage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheReadInputTokens: 80,
      cacheWriteInputTokens: 60,
    };

    const result = convertAmazonBedrockUsage(rawUsage);

    expect(result.raw).toEqual(rawUsage);
  });
});
