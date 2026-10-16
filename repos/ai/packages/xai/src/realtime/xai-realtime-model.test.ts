import { describe, it, expect, vi } from 'vitest';
import { XaiRealtimeModel } from './xai-realtime-model';

describe('XaiRealtimeModel', () => {
  const createModel = (fetch?: typeof globalThis.fetch) =>
    new XaiRealtimeModel('grok-voice-latest', {
      provider: 'xai.realtime',
      baseURL: 'https://api.x.ai/v1',
      headers: () => ({ authorization: 'Bearer test-key' }),
      fetch,
    });

  describe('doCreateClientSecret', () => {
    it('includes the model as a query param on the WebSocket URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ value: 'secret', expires_at: 123 }),
      });

      const result = await createModel(
        mockFetch as unknown as typeof fetch,
      ).doCreateClientSecret({});

      // xAI selects the voice model from the `model` query param; without it
      // the model choice is silently ignored.
      expect(result.url).toBe(
        'wss://api.x.ai/v1/realtime?model=grok-voice-latest',
      );
    });
  });

  describe('serializeClientEvent', () => {
    it('drops conversation-item-truncate (unsupported over WebSocket)', () => {
      const result = createModel().serializeClientEvent({
        type: 'conversation-item-truncate',
        itemId: 'item-1',
        contentIndex: 0,
        audioEndMs: 100,
      });

      expect(result).toBeUndefined();
    });
  });
});
