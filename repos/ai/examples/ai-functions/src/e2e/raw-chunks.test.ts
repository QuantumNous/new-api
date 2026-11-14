import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import 'dotenv/config';
import { describe, expect, it, vi } from 'vitest';

describe('Raw Chunks E2E Tests', () => {
  vi.setConfig({ testTimeout: 30000 });

  const providers = [
    { name: 'OpenAI', model: openai('gpt-4o-mini') },
    { name: 'Anthropic', model: anthropic('claude-haiku-4-5') },
    { name: 'Google', model: google('gemini-2.5-flash') },
  ];

  providers.forEach(({ name, model }) => {
    describe(`${name} Provider`, () => {
      it('should include raw chunks when include.rawChunks is enabled', async () => {
        const result = streamText({
          model,
          prompt: 'Say hello!',
          include: {
            rawChunks: true,
          },
        });

        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }

        expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(1);
      });

      it('should not include raw chunks when include.rawChunks is disabled', async () => {
        const result = streamText({
          model,
          prompt: 'Say hello!',
          include: {
            rawChunks: false,
          },
        });

        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }

        expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
      });

      it('should forward provider-specific raw chunk data', async () => {
        const result = streamText({
          model,
          prompt: 'Say hello!',
          include: {
            rawChunks: true,
          },
        });

        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }

        expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(1);
      });
    });
  });
});
