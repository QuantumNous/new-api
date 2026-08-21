import { describe, it, expect } from 'vitest';
import {
  groqLanguageModelChatOptions,
  type GroqLanguageModelChatOptions,
} from './groq-chat-language-model-options';
describe('groqLanguageModelChatOptions', () => {
  describe('reasoningEffort', () => {
    it('accepts valid reasoningEffort values', () => {
      const validValues = ['none', 'default', 'low', 'medium', 'high'] as const;

      validValues.forEach(value => {
        const result = groqLanguageModelChatOptions.safeParse({
          reasoningEffort: value,
        });
        expect(result.success).toBe(true);
        expect(result.data?.reasoningEffort).toBe(value);
      });
    });

    it('rejects invalid reasoningEffort values', () => {
      const invalidValues = [
        'invalid',
        'high-effort',
        'minimal',
        'maximum',
        '',
      ];

      invalidValues.forEach(value => {
        const result = groqLanguageModelChatOptions.safeParse({
          reasoningEffort: value,
        });
        expect(result.success).toBe(false);
      });
    });

    it('allows reasoningEffort to be undefined', () => {
      const result = groqLanguageModelChatOptions.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.reasoningEffort).toBeUndefined();
    });

    it('allows reasoningEffort to be omitted explicitly', () => {
      const result = groqLanguageModelChatOptions.safeParse({
        reasoningEffort: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.data?.reasoningEffort).toBeUndefined();
    });
  });

  describe('combined options with reasoningEffort', () => {
    it('accepts reasoningEffort with other valid options', () => {
      const result = groqLanguageModelChatOptions.safeParse({
        reasoningEffort: 'high',
        parallelToolCalls: true,
        user: 'test-user',
        structuredOutputs: false,
        serviceTier: 'flex',
      });

      expect(result.success).toBe(true);
      expect(result.data?.reasoningEffort).toBe('high');
      expect(result.data?.parallelToolCalls).toBe(true);
      expect(result.data?.user).toBe('test-user');
    });

    it('rejects when reasoningEffort is invalid among valid options', () => {
      const result = groqLanguageModelChatOptions.safeParse({
        reasoningEffort: 'ultra-high',
        parallelToolCalls: true,
        user: 'test-user',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('serviceTier', () => {
    it('accepts valid serviceTier values', () => {
      const validValues = ['on_demand', 'performance', 'flex', 'auto'] as const;

      validValues.forEach(value => {
        const result = groqLanguageModelChatOptions.safeParse({
          serviceTier: value,
        });
        expect(result.success).toBe(true);
        expect(result.data?.serviceTier).toBe(value);
      });
    });

    it('rejects invalid serviceTier values', () => {
      const invalidValues = ['priority', 'default', 'turbo', ''];

      invalidValues.forEach(value => {
        const result = groqLanguageModelChatOptions.safeParse({
          serviceTier: value,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('all reasoningEffort enum variants', () => {
    it('validates all reasoningEffort variants individually', () => {
      const variants: Array<'none' | 'default' | 'low' | 'medium' | 'high'> = [
        'none',
        'default',
        'low',
        'medium',
        'high',
      ];

      variants.forEach(variant => {
        const result = groqLanguageModelChatOptions.safeParse({
          reasoningEffort: variant,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.reasoningEffort).toBe(variant);
        }
      });
    });
  });

  describe('type inference', () => {
    it('infers GroqLanguageModelChatOptions type correctly', () => {
      const options: GroqLanguageModelChatOptions = {
        reasoningEffort: 'medium',
        parallelToolCalls: false,
      };

      expect(options.reasoningEffort).toBe('medium');
      expect(options.parallelToolCalls).toBe(false);
    });
  });
});
