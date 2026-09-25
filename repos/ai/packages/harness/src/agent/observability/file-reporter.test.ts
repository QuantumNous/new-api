import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { HarnessDiagnostic } from './types';
import { createFileReporter } from './file-reporter';

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'harness-file-reporter-'));
}

function readLines(dir: string): Array<Record<string, unknown>> {
  const text = readFileSync(join(dir, 'events.jsonl'), 'utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

const diag = (over: Partial<HarnessDiagnostic> = {}): HarnessDiagnostic => ({
  level: 'info',
  message: 'sandbox line',
  subsystem: 'sandbox.log.test',
  kind: 'log',
  source: 'test',
  stream: 'stdout',
  sessionId: 's1',
  timestamp: 1,
  ...over,
});

// Minimal event shapes — only the fields the reporter reads.
const startEvent = {
  callId: 'call-1',
  operationId: 'ai.harness',
  modelId: 'm',
  messages: [{ role: 'user', content: 'what is 2+2?' }],
  instructions: 'be terse',
} as never;
const stepStartEvent = { callId: 'call-1', stepNumber: 0 } as never;
const toolStartEvent = {
  callId: 'call-1',
  toolCall: { toolName: 'bash', toolCallId: 'c1', input: '{}' },
} as never;
const toolEndEvent = {
  callId: 'call-1',
  toolCall: { toolCallId: 'c1' },
  toolOutput: { type: 'tool-result', output: { ok: true } },
} as never;
const stepFinishEvent = {
  callId: 'call-1',
  usage: {},
  content: [{ type: 'text', text: '4' }],
} as never;
const endEvent = {
  callId: 'call-1',
  finishReason: 'stop',
  totalUsage: {},
} as never;

describe('createFileReporter', () => {
  test('writes a unified, non-lossy events.jsonl with spans AND diagnostics', () => {
    const dir = tmp();
    const reporter = createFileReporter({ dir });

    reporter.onStart!(startEvent);
    reporter.onStepStart!(stepStartEvent);
    reporter.ingestDiagnostic!(diag({ message: 'hello from sandbox' }));
    reporter.onToolExecutionStart!(toolStartEvent);
    reporter.onToolExecutionEnd!(toolEndEvent);
    reporter.onStepFinish!(stepFinishEvent);
    reporter.onEnd!(endEvent);

    const lines = readLines(dir);
    const kinds = lines.map(l => l.kind);
    expect(kinds).toEqual([
      'turn-start',
      'step-start',
      'diagnostic',
      'tool-start',
      'tool-end',
      'step-finish',
      'turn-finish',
    ]);

    // The diagnostic survived intact alongside the spans (non-lossy).
    const d = lines.find(l => l.kind === 'diagnostic');
    expect(d).toBeDefined();
    const captured = d!.diagnostic as HarnessDiagnostic;
    expect(captured.message).toBe('hello from sandbox');

    // Input prompt is captured on turn-start, output content on step-finish.
    const turnStart = lines.find(l => l.kind === 'turn-start');
    expect((turnStart!.input as { messages: unknown[] }).messages).toEqual([
      { role: 'user', content: 'what is 2+2?' },
    ]);
    const stepFinish = lines.find(l => l.kind === 'step-finish');
    expect(stepFinish!.output).toEqual([{ type: 'text', text: '4' }]);
  });

  test('recordInputs/recordOutputs: false suppress message content', () => {
    const dir = tmp();
    const reporter = createFileReporter({ dir });
    reporter.onStart!({
      ...(startEvent as object),
      recordInputs: false,
    } as never);
    reporter.onStepStart!(stepStartEvent);
    reporter.onStepFinish!({
      ...(stepFinishEvent as object),
      recordOutputs: false,
    } as never);
    reporter.onEnd!(endEvent);

    const lines = readLines(dir);
    expect(lines.find(l => l.kind === 'turn-start')!.input).toBeUndefined();
    expect(lines.find(l => l.kind === 'step-finish')!.output).toBeUndefined();
  });

  test('failOnly skips a clean turn but writes a turn that errored', () => {
    const dir = tmp();
    const reporter = createFileReporter({ dir, failOnly: true });

    // Clean turn — nothing should be written.
    reporter.onStart!(startEvent);
    reporter.onStepStart!(stepStartEvent);
    reporter.onStepFinish!(stepFinishEvent);
    reporter.onEnd!(endEvent);
    expect(existsSync(join(dir, 'events.jsonl'))).toBe(false);

    // Errored turn — flushed on end.
    const errCall = {
      callId: 'call-2',
      operationId: 'ai.harness',
      modelId: 'm',
    } as never;
    reporter.onStart!(errCall);
    reporter.ingestDiagnostic!(diag({ level: 'error', message: 'boom' }));
    reporter.onEnd!({
      callId: 'call-2',
      finishReason: 'error',
      totalUsage: {},
    } as never);

    const lines = readLines(dir);
    expect(lines.some(l => l.kind === 'diagnostic')).toBe(true);
    expect(
      lines.every(l => l.callId === 'call-2' || l.kind === 'diagnostic'),
    ).toBe(true);
  });
});
