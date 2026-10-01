import { describe, it, expect, vi } from 'vitest';
import { OpenAIRealtimeModel } from './openai-realtime-model';

describe('OpenAIRealtimeModel', () => {
  describe('doCreateClientSecret', () => {
    const createModel = (fetch: typeof globalThis.fetch) =>
      new OpenAIRealtimeModel('gpt-realtime', {
        provider: 'openai.realtime',
        baseURL: 'https://api.openai.com/v1',
        headers: () => ({ authorization: 'Bearer test-key' }),
        fetch,
      });

    it('omits expires_after when no ttl is requested', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ value: 'secret', expires_at: 123 }),
      });

      await createModel(
        mockFetch as unknown as typeof fetch,
      ).doCreateClientSecret({});

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.expires_after).toBeUndefined();
    });

    it('includes the required anchor with expires_after', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ value: 'secret', expires_at: 123 }),
      });

      await createModel(
        mockFetch as unknown as typeof fetch,
      ).doCreateClientSecret({ expiresAfterSeconds: 60 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // The client secrets endpoint 400s without `anchor`.
      expect(body.expires_after).toEqual({
        anchor: 'created_at',
        seconds: 60,
      });
    });
  });
});
