import { describe, it, expect, vi } from 'vitest';
import { DeepInfraChatLanguageModel } from './deepinfra-chat-language-model';

describe('DeepInfraChatLanguageModel', () => {
  describe('usage calculation', () => {
    it('should fix incorrect completion_tokens for gemini/gemma models when reasoning_tokens > completion_tokens', async () => {
      const responseBody = {
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'google/gemma-2-9b-it',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
        // This is the problematic usage data from DeepInfra for gemini/gemma models
        usage: {
          prompt_tokens: 19,
          completion_tokens: 84,
          total_tokens: 1184,
          prompt_tokens_details: null,
          completion_tokens_details: {
            reasoning_tokens: 1081,
          },
        },
      };

      const model = new DeepInfraChatLanguageModel('google/gemma-2-9b-it', {
        provider: 'deepinfra.chat',
        url: () => 'https://api.deepinfra.com/v1/openai/chat/completions',
        headers: () => ({ Authorization: 'Bearer test-key' }),
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ) as any,
      });

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      });

      // The usage should be corrected:
      // - completion_tokens should be text + reasoning: 84 + 1081 = 1165
      // - text tokens should be 84 (the original completion_tokens value)
      // - reasoning tokens should be 1081
      expect(result.usage.outputTokens.total).toBe(1165); // 84 + 1081
      expect(result.usage.outputTokens.text).toBe(84);
      expect(result.usage.outputTokens.reasoning).toBe(1081);
    });

    it('should not modify usage for non-gemini models with correct data', async () => {
      const responseBody = {
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 18,
          completion_tokens: 475,
          total_tokens: 493,
          prompt_tokens_details: null,
        },
      };

      const model = new DeepInfraChatLanguageModel(
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        {
          provider: 'deepinfra.chat',
          url: () => 'https://api.deepinfra.com/v1/openai/chat/completions',
          headers: () => ({ Authorization: 'Bearer test-key' }),
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify(responseBody), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ) as any,
        },
      );

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      });

      expect(result.usage.outputTokens.total).toBe(475);
      expect(result.usage.outputTokens.text).toBe(475);
      expect(result.usage.outputTokens.reasoning).toBe(0);
    });
  });
});
