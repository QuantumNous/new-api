import type { ToolApprovalConfiguration } from 'ai';
import { describe, expect, it } from 'vitest';
import { type PolicyDecisionEvent, shadow } from './shadow';

type AnyTools = Record<string, never>;

function callApproval(
  toolApproval: unknown,
  toolName: string,
  input: unknown = {},
): Promise<unknown> {
  if (typeof toolApproval !== 'function') {
    throw new Error('expected wrapped approval to be a generic function');
  }
  return toolApproval({
    toolCall: {
      type: 'tool-call',
      toolCallId: `call-${toolName}`,
      toolName,
      input,
      dynamic: false,
    } as never,
    tools: undefined,
    toolsContext: undefined as never,
    runtimeContext: undefined,
    messages: [],
  });
}

describe('shadow', () => {
  it('reports the policy decision but acts as approved by default', async () => {
    const denyOriginal = async () =>
      ({ type: 'denied', reason: 'pushes' }) as never;
    const events: PolicyDecisionEvent[] = [];

    const wrapped = shadow<AnyTools>(
      denyOriginal as ToolApprovalConfiguration<AnyTools, unknown>,
      { onDecision: event => void events.push(event) },
    );

    const status = await callApproval(wrapped, 'git', { args: ['push'] });

    expect(status).toEqual({ type: 'approved' });
    // event is fire-and-forget; wait a tick for the microtask.
    await new Promise(r => setTimeout(r, 0));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      toolCall: {
        toolName: 'git',
        toolCallId: 'call-git',
        input: { args: ['push'] },
      },
      decision: { type: 'denied', reason: 'pushes' },
      enforced: false,
      effective: { type: 'approved' },
    });
  });

  it('enforces the real decision when enforce: true', async () => {
    const denyOriginal = async () =>
      ({ type: 'denied', reason: 'pushes' }) as never;
    const events: PolicyDecisionEvent[] = [];

    const wrapped = shadow<AnyTools>(
      denyOriginal as ToolApprovalConfiguration<AnyTools, unknown>,
      { enforce: true, onDecision: event => void events.push(event) },
    );

    const status = await callApproval(wrapped, 'git', { args: ['push'] });

    expect(status).toEqual({ type: 'denied', reason: 'pushes' });
    await new Promise(r => setTimeout(r, 0));
    expect(events[0]).toMatchObject({
      decision: { type: 'denied', reason: 'pushes' },
      enforced: true,
      effective: { type: 'denied', reason: 'pushes' },
    });
  });

  it('reports approve decisions too (full audit trail)', async () => {
    const allow = async () => 'approved' as never;
    const events: PolicyDecisionEvent[] = [];

    const wrapped = shadow<AnyTools>(
      allow as ToolApprovalConfiguration<AnyTools, unknown>,
      { onDecision: event => void events.push(event) },
    );

    await callApproval(wrapped, 'search');
    await new Promise(r => setTimeout(r, 0));

    expect(events[0]).toMatchObject({
      decision: { type: 'approved' },
      enforced: false,
      effective: { type: 'approved' },
    });
  });

  it('normalizes string statuses to the narrow object form', async () => {
    const stringOriginal = async () => 'user-approval' as never;
    const events: PolicyDecisionEvent[] = [];

    const wrapped = shadow<AnyTools>(
      stringOriginal as ToolApprovalConfiguration<AnyTools, unknown>,
      { onDecision: event => void events.push(event) },
    );

    await callApproval(wrapped, 'kubectl');
    await new Promise(r => setTimeout(r, 0));

    expect(events[0].decision).toEqual({ type: 'user-approval' });
  });

  it('handles per-tool-map approvals and looks up the right entry', async () => {
    const events: PolicyDecisionEvent[] = [];
    const map = {
      git: { type: 'denied', reason: 'no git in shadow' } as const,
      search: 'approved' as const,
    };

    const wrapped = shadow<AnyTools>(
      map as unknown as ToolApprovalConfiguration<AnyTools, unknown>,
      { onDecision: event => void events.push(event) },
    );

    await callApproval(wrapped, 'git');
    await callApproval(wrapped, 'search');
    await callApproval(wrapped, 'undeclared');
    await new Promise(r => setTimeout(r, 0));

    expect(events.map(e => e.decision)).toEqual([
      { type: 'denied', reason: 'no git in shadow' },
      { type: 'approved' },
      { type: 'not-applicable' },
    ]);
  });

  it('swallows errors thrown from onDecision so enforcement is unaffected', async () => {
    const denyOriginal = async () => ({ type: 'denied' }) as never;

    const wrapped = shadow<AnyTools>(
      denyOriginal as ToolApprovalConfiguration<AnyTools, unknown>,
      {
        enforce: true,
        onDecision: () => {
          throw new Error('telemetry pipeline is down');
        },
      },
    );

    // The approval call must resolve with the policy's decision even though
    // the telemetry callback threw.
    await expect(callApproval(wrapped, 'git')).resolves.toEqual({
      type: 'denied',
    });
    // Give the swallow handler a tick.
    await new Promise(r => setTimeout(r, 0));
  });

  it('works with no onDecision callback (silent shadow)', async () => {
    const wrapped = shadow<AnyTools>(
      (async () => ({ type: 'denied' }) as never) as ToolApprovalConfiguration<
        AnyTools,
        unknown
      >,
    );

    const status = await callApproval(wrapped, 'git');
    expect(status).toEqual({ type: 'approved' });
  });

  it('does not block on a slow onDecision callback', async () => {
    // Verify fire-and-forget semantics by using a callback that never resolves.
    const wrapped = shadow<AnyTools>(
      (async () =>
        ({ type: 'approved' }) as never) as ToolApprovalConfiguration<
        AnyTools,
        unknown
      >,
      { onDecision: () => new Promise(() => {}) },
    );

    // The wrapper should return without waiting for onDecision.
    const start = Date.now();
    await callApproval(wrapped, 'fast');
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('records timestamps as ISO 8601', async () => {
    const events: PolicyDecisionEvent[] = [];
    const wrapped = shadow<AnyTools>(
      (async () =>
        ({ type: 'approved' }) as never) as ToolApprovalConfiguration<
        AnyTools,
        unknown
      >,
      { onDecision: event => void events.push(event) },
    );

    await callApproval(wrapped, 'whatever');
    await new Promise(r => setTimeout(r, 0));

    expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
