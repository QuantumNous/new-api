import { describe, it, expect } from 'vitest';
import { convertMoonshotAIChatUsage } from './convert-moonshotai-chat-usage';

describe('convertMoonshotAIChatUsage', () => {
  it('should handle null usage', () => {
    const result = convertMoonshotAIChatUsage(null);

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
    const result = convertMoonshotAIChatUsage(undefined);

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

  it('should convert basic usage without caching or reasoning', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 100,
        cacheRead: 0,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    });
  });

  it('should convert usage with top-level cached_tokens (Moonshot format)', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      cached_tokens: 30,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 70,
        cacheRead: 30,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 50,
        cached_tokens: 30,
      },
    });
  });

  it('should convert usage with nested cached_tokens (OpenAI format)', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_tokens_details: {
        cached_tokens: 25,
      },
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 75,
        cacheRead: 25,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 50,
        prompt_tokens_details: {
          cached_tokens: 25,
        },
      },
    });
  });

  it('should prioritize top-level cached_tokens over nested', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      cached_tokens: 40,
      prompt_tokens_details: {
        cached_tokens: 25,
      },
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 60,
        cacheRead: 40,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 50,
        cached_tokens: 40,
        prompt_tokens_details: {
          cached_tokens: 25,
        },
      },
    });
  });

  it('should convert usage with reasoning tokens', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 80,
      completion_tokens_details: {
        reasoning_tokens: 30,
      },
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 100,
        cacheRead: 0,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 80,
        text: 50,
        reasoning: 30,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 80,
        completion_tokens_details: {
          reasoning_tokens: 30,
        },
      },
    });
  });

  it('should convert usage with both cached and reasoning tokens', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: 100,
      completion_tokens: 80,
      cached_tokens: 35,
      completion_tokens_details: {
        reasoning_tokens: 30,
      },
    });

    expect(result).toEqual({
      inputTokens: {
        total: 100,
        noCache: 65,
        cacheRead: 35,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 80,
        text: 50,
        reasoning: 30,
      },
      raw: {
        prompt_tokens: 100,
        completion_tokens: 80,
        cached_tokens: 35,
        completion_tokens_details: {
          reasoning_tokens: 30,
        },
      },
    });
  });

  it('should handle null values in usage fields', () => {
    const result = convertMoonshotAIChatUsage({
      prompt_tokens: null,
      completion_tokens: null,
      cached_tokens: null,
    });

    expect(result).toEqual({
      inputTokens: {
        total: 0,
        noCache: 0,
        cacheRead: 0,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 0,
        text: 0,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: null,
        completion_tokens: null,
        cached_tokens: null,
      },
    });
  });
});
