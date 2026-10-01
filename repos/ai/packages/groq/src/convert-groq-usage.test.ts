import { describe, it, expect } from 'vitest';
import { convertGroqUsage } from './convert-groq-usage';

describe('convertGroqUsage', () => {
  it('should return undefined values when usage is null', () => {
    const result = convertGroqUsage(null);

    expect(result).toStrictEqual({
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

  it('should return undefined values when usage is undefined', () => {
    const result = convertGroqUsage(undefined);

    expect(result).toStrictEqual({
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

  it('should convert basic usage without token details', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: 20,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: undefined,
      },
      raw: {
        prompt_tokens: 20,
        completion_tokens: 10,
      },
    });
  });

  it('should extract reasoning tokens from completion_tokens_details', () => {
    const result = convertGroqUsage({
      prompt_tokens: 79,
      completion_tokens: 40,
      completion_tokens_details: {
        reasoning_tokens: 21,
      },
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 79,
        noCache: 79,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 40,
        text: 19, // 40 - 21 = 19
        reasoning: 21,
      },
      raw: {
        prompt_tokens: 79,
        completion_tokens: 40,
        completion_tokens_details: {
          reasoning_tokens: 21,
        },
      },
    });
  });

  it('should handle null reasoning_tokens in completion_tokens_details', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
      completion_tokens_details: {
        reasoning_tokens: null,
      },
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: 20,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: undefined,
      },
      raw: {
        prompt_tokens: 20,
        completion_tokens: 10,
        completion_tokens_details: {
          reasoning_tokens: null,
        },
      },
    });
  });

  it('should handle null completion_tokens_details', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
      completion_tokens_details: null,
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: 20,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: undefined,
      },
      raw: {
        prompt_tokens: 20,
        completion_tokens: 10,
        completion_tokens_details: null,
      },
    });
  });

  it('should handle zero reasoning tokens', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
      completion_tokens_details: {
        reasoning_tokens: 0,
      },
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: 20,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 20,
        completion_tokens: 10,
        completion_tokens_details: {
          reasoning_tokens: 0,
        },
      },
    });
  });

  it('should handle all tokens being reasoning tokens', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 50,
      completion_tokens_details: {
        reasoning_tokens: 50,
      },
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: 20,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 0, // 50 - 50 = 0
        reasoning: 50,
      },
      raw: {
        prompt_tokens: 20,
        completion_tokens: 50,
        completion_tokens_details: {
          reasoning_tokens: 50,
        },
      },
    });
  });

  it('should map cached_tokens to cacheRead and subtract from noCache', () => {
    const result = convertGroqUsage({
      prompt_tokens: 4641,
      completion_tokens: 1817,
      prompt_tokens_details: {
        cached_tokens: 4608,
      },
    });

    expect(result).toStrictEqual({
      inputTokens: {
        total: 4641,
        noCache: 33, // 4641 - 4608
        cacheRead: 4608,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 1817,
        text: 1817,
        reasoning: undefined,
      },
      raw: {
        prompt_tokens: 4641,
        completion_tokens: 1817,
        prompt_tokens_details: {
          cached_tokens: 4608,
        },
      },
    });
  });

  it('should treat zero cached_tokens as a cache miss (cacheRead 0)', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
      prompt_tokens_details: {
        cached_tokens: 0,
      },
    });

    expect(result.inputTokens).toStrictEqual({
      total: 20,
      noCache: 20,
      cacheRead: 0,
      cacheWrite: undefined,
    });
  });

  it('should leave cacheRead undefined when cached_tokens is null', () => {
    const result = convertGroqUsage({
      prompt_tokens: 20,
      completion_tokens: 10,
      prompt_tokens_details: {
        cached_tokens: null,
      },
    });

    expect(result.inputTokens).toStrictEqual({
      total: 20,
      noCache: 20,
      cacheRead: undefined,
      cacheWrite: undefined,
    });
  });

  it('should handle missing prompt_tokens and completion_tokens', () => {
    const result = convertGroqUsage({});

    expect(result).toStrictEqual({
      inputTokens: {
        total: 0,
        noCache: 0,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 0,
        text: 0,
        reasoning: undefined,
      },
      raw: {},
    });
  });
});
