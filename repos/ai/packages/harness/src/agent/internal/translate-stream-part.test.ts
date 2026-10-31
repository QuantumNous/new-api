import type { TextStreamPart, ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import { translateStreamPart } from './translate-stream-part';

describe('translateStreamPart', () => {
  it('returns no parts for a tool-call event (validation is handled by run-prompt)', () => {
    const out = translateStreamPart<ToolSet>({
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'bash',
      input: '{"command":"ls"}',
      nativeName: 'Bash',
      providerExecuted: true,
    });
    expect(out).toHaveLength(0);
  });

  it('fans file-change out into a dynamic provider-executed tool-call + tool-result pair', () => {
    const out = translateStreamPart<ToolSet>({
      type: 'file-change',
      event: 'create',
      path: 'notes.md',
    });
    expect(out).toHaveLength(2);

    const call = out[0] as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-call' }
    >;
    const result = out[1] as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-result' }
    >;

    expect(call.type).toBe('tool-call');
    expect(call.toolName).toBe('fileChange');
    expect(call.input).toEqual({ event: 'create', path: 'notes.md' });
    expect(call.dynamic).toBe(true);
    expect(call.providerExecuted).toBe(true);

    expect(result.type).toBe('tool-result');
    expect(result.toolName).toBe('fileChange');
    expect(result.output).toEqual({ event: 'create', path: 'notes.md' });
    expect(result.dynamic).toBe(true);
    expect(result.providerExecuted).toBe(true);

    // The synthetic pair shares one tool-call id.
    expect(result.toolCallId).toBe(call.toolCallId);
    expect(call.toolCallId).toMatch(/^harness-file-change-/);
  });

  it('fans compaction out into a dynamic provider-executed tool-call + tool-result pair with empty input and metadata output', () => {
    const out = translateStreamPart<ToolSet>({
      type: 'compaction',
      trigger: 'auto',
      summary: 'Summarized the earlier conversation.',
      tokensBefore: 120000,
      tokensAfter: 38000,
    });
    expect(out).toHaveLength(2);

    const call = out[0] as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-call' }
    >;
    const result = out[1] as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-result' }
    >;

    expect(call.type).toBe('tool-call');
    expect(call.toolName).toBe('compaction');
    expect(call.input).toEqual({});
    expect(call.dynamic).toBe(true);
    expect(call.providerExecuted).toBe(true);

    expect(result.type).toBe('tool-result');
    expect(result.toolName).toBe('compaction');
    expect(result.input).toEqual({});
    expect(result.output).toEqual({
      trigger: 'auto',
      summary: 'Summarized the earlier conversation.',
      tokensBefore: 120000,
      tokensAfter: 38000,
    });
    expect(result.dynamic).toBe(true);
    expect(result.providerExecuted).toBe(true);

    expect(result.toolCallId).toBe(call.toolCallId);
    expect(call.toolCallId).toMatch(/^harness-compaction-/);
  });

  it('omits optional token fields on the compaction output when absent', () => {
    const out = translateStreamPart<ToolSet>({
      type: 'compaction',
      trigger: 'manual',
      summary: 'Compacted.',
    });
    const result = out[1] as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-result' }
    >;
    expect(result.output).toEqual({ trigger: 'manual', summary: 'Compacted.' });
  });

  it('returns empty for events consumed internally (stream-start, finish-step, finish)', () => {
    expect(translateStreamPart<ToolSet>({ type: 'stream-start' })).toEqual([]);
    expect(
      translateStreamPart<ToolSet>({
        type: 'finish-step',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0 },
          outputTokens: { total: 0 },
        } as never,
      } as never),
    ).toEqual([]);
    expect(
      translateStreamPart<ToolSet>({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        totalUsage: {
          inputTokens: { total: 0 },
          outputTokens: { total: 0 },
        } as never,
      } as never),
    ).toEqual([]);
  });
});
