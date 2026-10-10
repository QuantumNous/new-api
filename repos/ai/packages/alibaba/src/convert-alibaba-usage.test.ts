import { describe, it, expect } from 'vitest';
import { convertAlibabaUsage } from './convert-alibaba-usage';

describe('convertAlibabaUsage', () => {
  it('should correctly calculate token distribution with cache tokens', () => {
    const result = convertAlibabaUsage({
      prompt_tokens: 200,
      completion_tokens: 75,
      prompt_tokens_details: {
        cached_tokens: 120,
        cache_creation_input_tokens: 50,
      },
      completion_tokens_details: {
        reasoning_tokens: 25,
      },
    });

    expect(result.inputTokens.total).toBe(200);
    expect(result.inputTokens.cacheRead).toBe(120);
    expect(result.inputTokens.cacheWrite).toBe(50);
    expect(result.inputTokens.noCache).toBe(30);
  });
});
