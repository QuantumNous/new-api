import { describe, expect, it } from 'vitest';
import {
  inboundMessageSchema,
  outboundMessageSchema,
  startMessageSchema,
} from './deepagents-bridge-protocol';

describe('deepagents bridge protocol', () => {
  it('parses a start message with deepagents extensions', () => {
    const parsed = startMessageSchema.parse({
      type: 'start',
      prompt: 'hello',
      instructions: 'be terse',
      model: 'anthropic/claude-sonnet-4',
      tools: [{ name: 'lookup', description: 'd', inputSchema: {} }],
    });
    expect(parsed.instructions).toBe('be terse');
  });

  it('accepts the shared inbound commands', () => {
    for (const msg of [
      { type: 'tool-result', toolCallId: 't1', output: { ok: true } },
      { type: 'user-message', text: 'more' },
      { type: 'abort' },
      { type: 'interrupt' },
      { type: 'shutdown' },
      { type: 'resume', lastSeenEventId: 3 },
      { type: 'detach' },
    ]) {
      expect(() => inboundMessageSchema.parse(msg)).not.toThrow();
    }
  });

  // These frames mirror exactly what the Node bridge emits. If the harness-v1
  // wire shapes change, this fails — signalling the bridge (src/bridge/index.ts)
  // needs the matching update.
  describe('outbound stream-part shapes emitted by the bridge', () => {
    const cases: Array<[string, unknown]> = [
      ['stream-start', { type: 'stream-start', modelId: 'claude-sonnet-4' }],
      ['text-start', { type: 'text-start', id: 'text-1' }],
      ['text-delta', { type: 'text-delta', id: 'text-1', delta: 'hi' }],
      ['text-end', { type: 'text-end', id: 'text-1' }],
      ['reasoning-delta', { type: 'reasoning-delta', id: 'r-1', delta: '...' }],
      [
        'tool-call',
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'bash',
          input: '{"command":"ls"}',
          providerExecuted: true,
          nativeName: 'shell',
        },
      ],
      [
        'tool-result',
        {
          type: 'tool-result',
          toolCallId: 'c1',
          toolName: 'bash',
          result: { stdout: 'ok' },
          isError: false,
        },
      ],
      [
        'finish-step',
        {
          type: 'finish-step',
          finishReason: { unified: 'stop' },
          usage: { inputTokens: { total: 1 }, outputTokens: { total: 2 } },
        },
      ],
      [
        'finish',
        {
          type: 'finish',
          finishReason: { unified: 'stop' },
          totalUsage: { inputTokens: { total: 1 }, outputTokens: { total: 2 } },
        },
      ],
      ['bridge-interrupted', { type: 'bridge-interrupted', ok: true }],
      ['error', { type: 'error', error: { message: 'boom' } }],
    ];

    for (const [name, frame] of cases) {
      it(`validates ${name}`, () => {
        expect(() => outboundMessageSchema.parse(frame)).not.toThrow();
      });
    }

    it('tolerates an extra seq field (stripped by validation)', () => {
      const parsed = outboundMessageSchema.parse({
        seq: 7,
        type: 'text-delta',
        id: 'text-1',
        delta: 'hi',
      });
      expect(parsed).not.toHaveProperty('seq');
    });
  });
});
