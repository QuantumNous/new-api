import { describe, expect, it, vi } from 'vitest';
import type { PolicyClient } from '../policy-client';
import { opaPolicy, optionalOpaPolicy } from './opa-policy';
import { stubClient } from './test-helpers';

describe('opaPolicy', () => {
  it('returns a generic ToolApprovalConfiguration that normalizes an allow decision', async () => {
    const client = stubClient({ decision: 'allow' });
    const approval = opaPolicy({ client, path: 'agent/call/decision' });

    if (typeof approval !== 'function') throw new Error('expected generic fn');

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'git',
        input: { args: ['status'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toEqual({ type: 'approved' });
  });

  it('forwards a deny reason from the Rego output', async () => {
    const client = stubClient({
      decision: 'deny',
      reason: 'pushes require approval',
    });
    const approval = opaPolicy({ client, path: 'agent/call/decision' });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'git',
        input: { args: ['push'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toEqual({
      type: 'denied',
      reason: 'pushes require approval',
    });
  });

  it('maps requires-approval to user-approval', async () => {
    const client = stubClient({ decision: 'requires-approval' });
    const approval = opaPolicy({ client, path: 'agent/call/decision' });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-3',
        toolName: 'kubectl',
        input: { verb: 'delete', resource: 'pod' },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toEqual({ type: 'user-approval' });
  });

  it('passes the default OPA input shape', async () => {
    const evaluate = vi.fn(async () => ({ decision: 'allow' }) as never);
    const client: PolicyClient = { evaluate };

    const approval = opaPolicy({ client, path: 'p' });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-direct',
        toolName: 'git',
        input: { args: ['push'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: { role: 'reviewer' },
      messages: [],
    });

    expect(evaluate).toHaveBeenCalledWith('p', {
      tool: { name: 'git' },
      args: { args: ['push'] },
      messages: [],
      runtimeContext: { role: 'reviewer' },
    });
  });

  it('honors a custom toInput transformer', async () => {
    const evaluate = vi.fn(async () => ({ decision: 'allow' }) as never);
    const client: PolicyClient = { evaluate };

    const approval = opaPolicy({
      client,
      path: 'p',
      toInput: ({ toolCall, runtimeContext }) => ({
        action: toolCall.toolName,
        principal: (runtimeContext as { role?: string } | undefined)?.role,
      }),
    });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-4',
        toolName: 'git',
        input: { args: ['status'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: { role: 'reviewer' },
      messages: [],
    });

    expect(evaluate).toHaveBeenCalledWith('p', {
      action: 'git',
      principal: 'reviewer',
    });
  });

  it('fails closed (denies) when the client throws, without rejecting', async () => {
    const client: PolicyClient = {
      async evaluate() {
        throw new Error('OPA unreachable');
      },
    };
    const approval = opaPolicy({ client, path: 'agent/call/decision' });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-err',
        toolName: 'git',
        input: { args: ['push'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toMatchObject({ type: 'denied' });
    expect((status as { reason: string }).reason).toContain('OPA unreachable');
  });

  it('serializes a non-Error throw into the deny reason', async () => {
    const client: PolicyClient = {
      async evaluate() {
        throw { code: 'ERR_TIMEOUT' };
      },
    };
    const approval = opaPolicy({ client, path: 'agent/call/decision' });
    if (typeof approval !== 'function') throw new Error('expected generic fn');

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-err',
        toolName: 'git',
        input: {},
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toMatchObject({ type: 'denied' });
    expect((status as { reason: string }).reason).toContain('ERR_TIMEOUT');
  });
});

describe('optionalOpaPolicy', () => {
  it('returns undefined when no client is supplied', () => {
    const approval = optionalOpaPolicy({
      client: undefined,
      path: 'agent/call/decision',
    });
    expect(approval).toBeUndefined();
  });

  it('delegates to opaPolicy when a client is supplied', async () => {
    const client = stubClient({ decision: 'allow' });
    const approval = optionalOpaPolicy({
      client,
      path: 'agent/call/decision',
    });

    if (typeof approval !== 'function') {
      throw new Error('expected generic approval function');
    }

    const status = await approval({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'git',
        input: { args: ['status'] },
        dynamic: false,
      } as never,
      tools: undefined,
      toolsContext: undefined as never,
      runtimeContext: undefined,
      messages: [],
    });

    expect(status).toEqual({ type: 'approved' });
  });
});
