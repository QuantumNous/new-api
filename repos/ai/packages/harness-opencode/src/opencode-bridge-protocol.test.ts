import { describe, expect, it } from 'vitest';
import {
  inboundMessageSchema,
  outboundMessageSchema,
} from './opencode-bridge-protocol';

describe('OpenCode bridge protocol', () => {
  it('accepts prompt and compact start operations', () => {
    expect(
      inboundMessageSchema.parse({
        type: 'start',
        operation: 'prompt',
        prompt: 'hi',
        tools: [],
        variant: 'high',
      }),
    ).toMatchInlineSnapshot(`
      {
        "operation": "prompt",
        "prompt": "hi",
        "tools": [],
        "type": "start",
        "variant": "high",
      }
    `);

    expect(
      inboundMessageSchema.parse({
        type: 'start',
        operation: 'compact',
        prompt: '',
        resumeSessionId: 'ses_123',
      }),
    ).toMatchInlineSnapshot(`
      {
        "operation": "compact",
        "prompt": "",
        "resumeSessionId": "ses_123",
        "type": "start",
      }
    `);
  });

  it('accepts shared bridge commands', () => {
    expect(inboundMessageSchema.parse({ type: 'abort' })).toEqual({
      type: 'abort',
    });
    expect(inboundMessageSchema.parse({ type: 'interrupt' })).toEqual({
      type: 'interrupt',
    });
    expect(
      inboundMessageSchema.parse({
        type: 'tool-result',
        toolCallId: 'tool-1',
        output: { ok: true },
      }),
    ).toEqual({
      type: 'tool-result',
      toolCallId: 'tool-1',
      output: { ok: true },
    });
  });

  it('accepts interrupt acknowledgements', () => {
    expect(
      outboundMessageSchema.parse({ type: 'bridge-interrupted', ok: true }),
    ).toEqual({
      type: 'bridge-interrupted',
      ok: true,
    });
  });
});
