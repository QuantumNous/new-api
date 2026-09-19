import { describe, expect, it } from 'vitest';
import {
  convertAnthropicUsage,
  type AnthropicUsage,
} from './convert-anthropic-usage';
describe('convertAnthropicUsage', () => {
  it('should use usage as raw when rawUsage is not provided', () => {
    const usage = {
      input_tokens: 10,
      output_tokens: 20,
    };

    const result = convertAnthropicUsage({ usage });

    expect(result.raw).toBe(usage);
  });

  it('should use rawUsage as raw when provided', () => {
    const usage = {
      input_tokens: 10,
      output_tokens: 20,
    };
    const rawUsage = {
      input_tokens: 10,
      output_tokens: 20,
      service_tier: 'standard',
      inference_geo: 'not_available',
      cache_creation: {
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 0,
      },
    };

    const result = convertAnthropicUsage({ usage, rawUsage });

    expect(result.raw).toBe(rawUsage);
  });

  it('should compute token totals correctly with cache tokens', () => {
    const result = convertAnthropicUsage({
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 5,
        cache_read_input_tokens: 3,
      },
    });

    expect(result.inputTokens).toEqual({
      total: 18,
      noCache: 10,
      cacheRead: 3,
      cacheWrite: 5,
    });
    expect(result.outputTokens).toEqual({
      total: 20,
      text: undefined,
      reasoning: undefined,
    });
  });

  it('should handle null cache tokens', () => {
    const usage: AnthropicUsage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    };

    const result = convertAnthropicUsage({ usage });

    expect(result.inputTokens.total).toBe(100);
    expect(result.inputTokens.cacheRead).toBe(0);
    expect(result.inputTokens.cacheWrite).toBe(0);
  });

  describe('compaction usage with iterations', () => {
    it('should sum across all iterations when iterations array is present', () => {
      const usage: AnthropicUsage = {
        input_tokens: 45000,
        output_tokens: 1234,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 180000,
            output_tokens: 3500,
          },
          {
            type: 'message',
            input_tokens: 23000,
            output_tokens: 1000,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      // Total should be sum of iterations, not top-level values
      expect(result.inputTokens.total).toBe(203000); // 180000 + 23000
      expect(result.inputTokens.noCache).toBe(203000);
      expect(result.outputTokens.total).toBe(4500); // 3500 + 1000
      expect(result.raw).toBe(usage);
    });

    it('should handle single iteration (message only, no compaction triggered)', () => {
      const usage: AnthropicUsage = {
        input_tokens: 5000,
        output_tokens: 500,
        iterations: [
          {
            type: 'message',
            input_tokens: 5000,
            output_tokens: 500,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      expect(result.inputTokens.total).toBe(5000);
      expect(result.outputTokens.total).toBe(500);
    });

    it('should handle multiple compaction iterations (long-running task)', () => {
      const usage: AnthropicUsage = {
        input_tokens: 10000,
        output_tokens: 500,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 200000,
            output_tokens: 4000,
          },
          {
            type: 'message',
            input_tokens: 50000,
            output_tokens: 2000,
          },
          {
            type: 'compaction',
            input_tokens: 180000,
            output_tokens: 3500,
          },
          {
            type: 'message',
            input_tokens: 30000,
            output_tokens: 1500,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      // Total = 200000 + 50000 + 180000 + 30000 = 460000 input
      // Total = 4000 + 2000 + 3500 + 1500 = 11000 output
      expect(result.inputTokens.total).toBe(460000);
      expect(result.outputTokens.total).toBe(11000);
    });

    it('should combine iterations with cache tokens', () => {
      const usage: AnthropicUsage = {
        input_tokens: 45000,
        output_tokens: 1234,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: 500,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 180000,
            output_tokens: 3500,
          },
          {
            type: 'message',
            input_tokens: 23000,
            output_tokens: 1000,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      // Total input = sum of iterations + cache tokens
      // noCache = sum of iterations only
      expect(result.inputTokens.noCache).toBe(203000); // 180000 + 23000
      expect(result.inputTokens.cacheWrite).toBe(1000);
      expect(result.inputTokens.cacheRead).toBe(500);
      expect(result.inputTokens.total).toBe(204500); // 203000 + 1000 + 500
      expect(result.outputTokens.total).toBe(4500); // 3500 + 1000
    });

    it('should use rawUsage as raw even when iterations are present', () => {
      const usage: AnthropicUsage = {
        input_tokens: 45000,
        output_tokens: 1234,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 180000,
            output_tokens: 3500,
          },
          {
            type: 'message',
            input_tokens: 23000,
            output_tokens: 1000,
          },
        ],
      };
      const rawUsage = {
        input_tokens: 45000,
        output_tokens: 1234,
        service_tier: 'standard',
      };

      const result = convertAnthropicUsage({ usage, rawUsage });

      expect(result.raw).toBe(rawUsage);
      expect(result.inputTokens.total).toBe(203000);
    });
  });

  describe('edge cases', () => {
    it('should use top-level values when iterations is null', () => {
      const usage: AnthropicUsage = {
        input_tokens: 100,
        output_tokens: 50,
        iterations: null,
      };

      const result = convertAnthropicUsage({ usage });

      expect(result.inputTokens.total).toBe(100);
      expect(result.outputTokens.total).toBe(50);
    });

    it('should use top-level values when iterations is undefined', () => {
      const usage: AnthropicUsage = {
        input_tokens: 100,
        output_tokens: 50,
      };

      const result = convertAnthropicUsage({ usage });

      expect(result.inputTokens.total).toBe(100);
      expect(result.outputTokens.total).toBe(50);
    });

    it('should use top-level values when iterations array is empty', () => {
      const usage: AnthropicUsage = {
        input_tokens: 100,
        output_tokens: 50,
        iterations: [],
      };

      const result = convertAnthropicUsage({ usage });

      expect(result.inputTokens.total).toBe(100);
      expect(result.outputTokens.total).toBe(50);
    });

    it('should handle zero tokens in iterations', () => {
      const usage: AnthropicUsage = {
        input_tokens: 0,
        output_tokens: 0,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 0,
            output_tokens: 0,
          },
          {
            type: 'message',
            input_tokens: 0,
            output_tokens: 0,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      expect(result.inputTokens.total).toBe(0);
      expect(result.outputTokens.total).toBe(0);
    });
  });

  describe('real-world scenarios from documentation', () => {
    it('should match documentation example exactly', () => {
      const usage: AnthropicUsage = {
        input_tokens: 45000,
        output_tokens: 1234,
        iterations: [
          {
            type: 'compaction',
            input_tokens: 180000,
            output_tokens: 3500,
          },
          {
            type: 'message',
            input_tokens: 23000,
            output_tokens: 1000,
          },
        ],
      };

      const result = convertAnthropicUsage({ usage });

      const expectedTotalInput = 180000 + 23000; // 203000
      const expectedTotalOutput = 3500 + 1000; // 4500

      expect(result.inputTokens.total).toBe(expectedTotalInput);
      expect(result.outputTokens.total).toBe(expectedTotalOutput);

      // The top-level values (45000, 1234) are NOT the billed amounts
      // when iterations is present
      expect(result.inputTokens.total).not.toBe(usage.input_tokens);
      expect(result.outputTokens.total).not.toBe(usage.output_tokens);
    });

    it('should handle re-applying previous compaction block (no new compaction)', () => {
      const usage: AnthropicUsage = {
        input_tokens: 15000,
        output_tokens: 800,
        // No iterations - previous compaction block was re-applied
      };

      const result = convertAnthropicUsage({ usage });

      // Top-level values are accurate when no new compaction triggered
      expect(result.inputTokens.total).toBe(15000);
      expect(result.outputTokens.total).toBe(800);
    });
  });
});
