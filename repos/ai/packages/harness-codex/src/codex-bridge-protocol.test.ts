import { describe, expect, it } from 'vitest';
import {
  bridgeReadySchema,
  inboundMessageSchema,
  outboundMessageSchema,
} from './codex-bridge-protocol';

describe('outboundMessageSchema', () => {
  const usage = {
    inputTokens: { total: 0, noCache: 0 },
    outputTokens: { total: 0, text: 0 },
  };
  const cases = [
    { type: 'stream-start' },
    { type: 'text-start', id: 'x' },
    { type: 'text-delta', id: 'x', delta: 'hi' },
    { type: 'text-end', id: 'x' },
    { type: 'reasoning-start', id: 'r' },
    { type: 'reasoning-delta', id: 'r', delta: 'thinking' },
    { type: 'reasoning-end', id: 'r' },
    {
      type: 'tool-call',
      toolCallId: 't1',
      toolName: 'bash',
      input: '{"command":"ls"}',
      nativeName: 'Bash',
      providerExecuted: true,
    },
    {
      type: 'tool-result',
      toolCallId: 't1',
      toolName: 'bash',
      result: { exitCode: 0, output: 'ok' },
    },
    {
      type: 'finish-step',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
    },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      totalUsage: usage,
    },
    { type: 'file-change', event: 'create', path: 'notes.md' },
    { type: 'file-change', event: 'modify', path: 'src/lib.ts' },
    { type: 'file-change', event: 'delete', path: 'old.txt' },
    { type: 'error', error: 'boom' },
    { type: 'raw', rawValue: { hello: 'world' } },
  ];

  for (const sample of cases) {
    it(`accepts ${sample.type}`, () => {
      expect(() => outboundMessageSchema.parse(sample)).not.toThrow();
    });
  }

  it('rejects unknown types', () => {
    expect(() =>
      outboundMessageSchema.parse({ type: 'mystery' as 'error', error: 1 }),
    ).toThrow();
  });
});

describe('inboundMessageSchema', () => {
  it('accepts a start message', () => {
    expect(() =>
      inboundMessageSchema.parse({
        type: 'start',
        prompt: 'hi',
        tools: [{ name: 'deploy' }],
        model: 'gpt-5.1',
        reasoningEffort: 'high',
        webSearch: true,
      }),
    ).not.toThrow();
  });

  it('accepts a tool-result message', () => {
    expect(() =>
      inboundMessageSchema.parse({
        type: 'tool-result',
        toolCallId: 't1',
        output: { ok: true },
      }),
    ).not.toThrow();
  });

  it('accepts a tool-approval-response message', () => {
    expect(() =>
      inboundMessageSchema.parse({
        type: 'tool-approval-response',
        approvalId: 'a1',
        approved: false,
        reason: 'not allowed',
      }),
    ).not.toThrow();
  });

  it('accepts user-message, abort, shutdown', () => {
    for (const sample of [
      { type: 'user-message', text: 'hi' },
      { type: 'abort' },
      { type: 'shutdown' },
    ]) {
      expect(() => inboundMessageSchema.parse(sample)).not.toThrow();
    }
  });
});

describe('bridgeReadySchema', () => {
  it('accepts the ready handshake', () => {
    expect(() =>
      bridgeReadySchema.parse({
        type: 'bridge-ready',
        port: 12345,
      }),
    ).not.toThrow();
  });

  it('rejects a non-ready type', () => {
    expect(() =>
      bridgeReadySchema.parse({
        type: 'nope',
        port: 12345,
      }),
    ).toThrow();
  });
});
