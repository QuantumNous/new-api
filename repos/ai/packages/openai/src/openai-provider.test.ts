import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidArgumentError } from '@ai-sdk/provider';
import { createOpenAI } from './openai-provider';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const createSuccessfulResponse = () =>
  new Response(
    JSON.stringify({
      object: 'list',
      data: [
        {
          object: 'embedding',
          index: 0,
          embedding: [0.1, 0.2],
        },
      ],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 1, total_tokens: 1 },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const createFetchMock = () =>
  vi.fn().mockResolvedValue(createSuccessfulResponse());

describe('createOpenAI', () => {
  describe('baseURL configuration', () => {
    const originalBaseUrl = process.env.OPENAI_BASE_URL;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      process.env.OPENAI_BASE_URL = originalBaseUrl;
    });

    it('uses the default OpenAI base URL when not provided', async () => {
      delete process.env.OPENAI_BASE_URL;

      const fetchMock = createFetchMock();
      const provider = createOpenAI({
        apiKey: 'test-api-key',
        fetch: fetchMock,
      });

      await provider.embedding('text-embedding-3-small').doEmbed({
        values: ['hello'],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0]!;
      expect(call[0]).toBe('https://api.openai.com/v1/embeddings');
    });

    it('uses OPENAI_BASE_URL when set', async () => {
      process.env.OPENAI_BASE_URL = 'https://proxy.openai.example/v1/';

      const fetchMock = createFetchMock();
      const provider = createOpenAI({
        apiKey: 'test-api-key',
        fetch: fetchMock,
      });

      await provider.embedding('text-embedding-3-small').doEmbed({
        values: ['hello'],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0]!;
      expect(call[0]).toBe('https://proxy.openai.example/v1/embeddings');
    });

    it('prefers the baseURL option over OPENAI_BASE_URL', async () => {
      process.env.OPENAI_BASE_URL = 'https://env.openai.example/v1';

      const fetchMock = createFetchMock();
      const provider = createOpenAI({
        apiKey: 'test-api-key',
        baseURL: 'https://option.openai.example/v1/',
        fetch: fetchMock,
      });

      await provider.embedding('text-embedding-3-small').doEmbed({
        values: ['hello'],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0]!;
      expect(call[0]).toBe('https://option.openai.example/v1/embeddings');
    });

    it('rejects an empty baseURL option during provider creation', () => {
      expect(() =>
        createOpenAI({
          apiKey: 'test-api-key',
          baseURL: '',
        }),
      ).toThrow(
        expect.objectContaining({
          name: 'AI_InvalidArgumentError',
          argument: 'baseURL',
          message: 'baseURL must be a non-empty string.',
        }),
      );
    });

    it('rejects an empty OPENAI_BASE_URL during provider creation', () => {
      process.env.OPENAI_BASE_URL = '';

      try {
        createOpenAI({ apiKey: 'test-api-key' });
      } catch (error) {
        expect(InvalidArgumentError.isInstance(error)).toBe(true);
        expect(error).toMatchObject({
          argument: 'baseURL',
          message: 'baseURL must be a non-empty string.',
        });
        return;
      }

      throw new Error('Expected createOpenAI to reject an empty base URL.');
    });

    it('uses the Responses API for the default language model', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'test error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const provider = createOpenAI({
        apiKey: 'test-api-key',
        baseURL: 'https://proxy.openai.example/v1/',
        fetch: fetchMock,
      });

      try {
        await provider('gpt-4o-mini').doGenerate({
          prompt: [
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        });
      } catch {}

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0]!;
      expect(call[0]).toBe('https://proxy.openai.example/v1/responses');
    });

    it('uses the Chat Completions API for chat models', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'test error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const provider = createOpenAI({
        apiKey: 'test-api-key',
        baseURL: 'https://proxy.openai.example/v1/',
        fetch: fetchMock,
      });

      try {
        await provider.chat('gpt-4o-mini').doGenerate({
          prompt: [
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        });
      } catch {}

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0]!;
      expect(call[0]).toBe('https://proxy.openai.example/v1/chat/completions');
    });
  });
});
