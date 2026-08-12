import type { Sandbox } from '@vercel/sandbox';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVercelSandbox } from './vercel-sandbox';

const { createMock, getMock, getOrCreateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getMock: vi.fn(),
  getOrCreateMock: vi.fn(),
}));

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: createMock,
    get: getMock,
    getOrCreate: getOrCreateMock,
  },
}));

type MockSpies = {
  domain: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  runCommand: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  routes: Array<{ port: number }>;
};

function makeMockSandbox(overrides: Partial<MockSpies> = {}) {
  const domain = overrides.domain ?? vi.fn();
  const update = overrides.update ?? vi.fn(async () => {});
  const runCommand = overrides.runCommand ?? vi.fn();
  const stop = overrides.stop ?? vi.fn(async () => {});
  const deleteSandbox = overrides.delete ?? vi.fn(async () => {});
  const routes: Array<{ port: number }> = overrides.routes ?? [{ port: 4000 }];
  const sandbox = {
    name: 'sbx_harness',
    domain,
    update,
    runCommand,
    stop,
    delete: deleteSandbox,
    routes,
    currentSession: () => ({ cwd: '/vercel/sandbox' }),
  } as unknown as Sandbox;
  return {
    sandbox,
    spies: { domain, update, runCommand, stop, delete: deleteSandbox, routes },
  };
}

describe('createVercelSandbox (wrap existing)', () => {
  it('produces a network sandbox session whose ports come from sandbox.routes', async () => {
    const { sandbox } = makeMockSandbox({
      routes: [{ port: 3000 }, { port: 4000 }],
    });
    const provider = createVercelSandbox({ sandbox });
    const sandboxSession = await provider.createSession();
    expect(sandboxSession.ports).toEqual([3000, 4000]);
  });

  it('restricted() returns an Experimental_SandboxSession wrapping the underlying', async () => {
    const { sandbox, spies } = makeMockSandbox();
    spies.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => 'ok\n',
      stderr: async () => '',
    });

    const sandboxSession = await createVercelSandbox({
      sandbox,
    }).createSession();
    const result = await sandboxSession
      .restricted()
      .run({ command: 'echo ok' });
    expect(result.stdout).toBe('ok\n');
  });

  it('stop is a no-op (caller owns lifecycle)', async () => {
    const { sandbox, spies } = makeMockSandbox();
    await (await createVercelSandbox({ sandbox }).createSession()).stop();
    expect(spies.stop).not.toHaveBeenCalled();
  });

  it('destroy is a no-op (caller owns lifecycle)', async () => {
    const { sandbox, spies } = makeMockSandbox();
    await (await createVercelSandbox({ sandbox }).createSession()).destroy?.();
    expect(spies.stop).not.toHaveBeenCalled();
    expect(spies.delete).not.toHaveBeenCalled();
  });

  describe('getPortUrl', () => {
    it('returns the value from sandbox.domain for https', async () => {
      const { sandbox, spies } = makeMockSandbox({
        routes: [{ port: 3000 }],
      });
      spies.domain.mockReturnValueOnce('https://sub.vercel.run');

      const handle = await createVercelSandbox({ sandbox }).createSession();
      const url = await handle.getPortUrl({ port: 3000 });
      expect(spies.domain).toHaveBeenCalledWith(3000);
      expect(url).toBe('https://sub.vercel.run/');
    });

    it('upgrades ws to wss when domain is https', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.domain.mockReturnValueOnce('https://sub.vercel.run');
      const handle = await createVercelSandbox({ sandbox }).createSession();
      const url = await handle.getPortUrl({ port: 4000, protocol: 'ws' });
      expect(url).toBe('wss://sub.vercel.run/');
    });

    it('keeps ws as ws when domain is http', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.domain.mockReturnValueOnce('http://sub.vercel.run');
      const handle = await createVercelSandbox({ sandbox }).createSession();
      const url = await handle.getPortUrl({ port: 4000, protocol: 'ws' });
      expect(url).toBe('ws://sub.vercel.run/');
    });

    it('throws when the requested port is not in the sandbox routes', async () => {
      const { sandbox } = makeMockSandbox({ routes: [{ port: 4000 }] });
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await expect(handle.getPortUrl({ port: 9999 })).rejects.toThrow(
        /Port 9999 is not exposed/,
      );
    });
  });

  describe('setNetworkPolicy', () => {
    it('maps allow-all', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({ mode: 'allow-all' });
      expect(spies.update).toHaveBeenCalledWith({ networkPolicy: 'allow-all' });
    });

    it('maps deny-all', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({ mode: 'deny-all' });
      expect(spies.update).toHaveBeenCalledWith({ networkPolicy: 'deny-all' });
    });

    it('maps custom with allowedHosts to { allow: [...] }', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({
        mode: 'custom',
        allowedHosts: ['api.example.com', '*.npmjs.org'],
      });
      expect(spies.update).toHaveBeenCalledWith({
        networkPolicy: { allow: ['api.example.com', '*.npmjs.org'] },
      });
    });

    it('maps custom with allowedCIDRs to { subnets: { allow: [...] } }', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({
        mode: 'custom',
        allowedCIDRs: ['10.0.0.0/8'],
      });
      expect(spies.update).toHaveBeenCalledWith({
        networkPolicy: { subnets: { allow: ['10.0.0.0/8'] } },
      });
    });

    it('maps custom with allowedHosts + deniedCIDRs to combined shape', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({
        mode: 'custom',
        allowedHosts: ['api.example.com'],
        deniedCIDRs: ['169.254.169.254/32'],
      });
      expect(spies.update).toHaveBeenCalledWith({
        networkPolicy: {
          allow: ['api.example.com'],
          subnets: { deny: ['169.254.169.254/32'] },
        },
      });
    });

    it('maps custom with both allowedCIDRs + deniedCIDRs', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setNetworkPolicy!({
        mode: 'custom',
        allowedCIDRs: ['10.0.0.0/8'],
        deniedCIDRs: ['10.5.0.0/16'],
      });
      expect(spies.update).toHaveBeenCalledWith({
        networkPolicy: {
          subnets: { allow: ['10.0.0.0/8'], deny: ['10.5.0.0/16'] },
        },
      });
    });
  });

  describe('setPorts', () => {
    it('forwards the requested port list to sandbox.update', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const handle = await createVercelSandbox({ sandbox }).createSession();
      await handle.setPorts!([4000, 5000]);
      expect(spies.update).toHaveBeenCalledWith(
        { ports: [4000, 5000] },
        undefined,
      );
    });
  });

  describe('bridgePorts', () => {
    it('is exposed on the provider when set on settings', () => {
      const { sandbox } = makeMockSandbox();
      const provider = createVercelSandbox({
        sandbox,
        bridgePorts: [5001, 5002],
      });
      expect(provider.bridgePorts).toEqual([5001, 5002]);
    });

    it('is undefined when not set', () => {
      const { sandbox } = makeMockSandbox();
      const provider = createVercelSandbox({ sandbox });
      expect(provider.bridgePorts).toBeUndefined();
    });
  });
});

describe('createVercelSandbox (create from scratch)', () => {
  beforeEach(() => {
    createMock.mockReset();
    getMock.mockReset();
    getOrCreateMock.mockReset();
    (
      globalThis as {
        [key: symbol]: Map<string, string> | undefined;
      }
    )[Symbol.for('ai-sdk.harness.vercel-template-snapshots')]?.clear();
  });

  it('applies a 30 minute default timeout when none is provided', async () => {
    const { sandbox } = makeMockSandbox();
    createMock.mockResolvedValueOnce(sandbox);

    await createVercelSandbox({}).createSession();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      timeout: 30 * 60 * 1_000,
    });
  });

  it('respects an explicitly provided timeout', async () => {
    const { sandbox } = makeMockSandbox();
    createMock.mockResolvedValueOnce(sandbox);

    await createVercelSandbox({ timeout: 60_000 }).createSession();

    expect(createMock.mock.calls[0][0]).toMatchObject({ timeout: 60_000 });
  });

  it('destroy stops and deletes owned sandboxes', async () => {
    const { sandbox, spies } = makeMockSandbox();
    createMock.mockResolvedValueOnce(sandbox);

    const handle = await createVercelSandbox({}).createSession();
    await handle.destroy?.();

    expect(spies.stop).toHaveBeenCalledTimes(1);
    expect(spies.delete).toHaveBeenCalledTimes(1);
  });

  it('destroy deletes owned sandboxes even when stop fails', async () => {
    const { sandbox, spies } = makeMockSandbox({
      stop: vi.fn(async () => {
        throw new Error('already stopped');
      }),
    });
    createMock.mockResolvedValueOnce(sandbox);

    const handle = await createVercelSandbox({}).createSession();
    await handle.destroy?.();

    expect(spies.stop).toHaveBeenCalledTimes(1);
    expect(spies.delete).toHaveBeenCalledTimes(1);
  });

  it('forwards credentials when resuming a named session', async () => {
    const { sandbox } = makeMockSandbox();
    getMock.mockResolvedValueOnce(sandbox);
    const abortController = new AbortController();

    await createVercelSandbox({
      token: 'token_test',
      teamId: 'team_test',
      projectId: 'prj_test',
    }).resumeSession?.({
      sessionId: 'session-123',
      abortSignal: abortController.signal,
    });

    expect(getMock).toHaveBeenCalledWith({
      name: 'ai-sdk-harness-session-session-123',
      token: 'token_test',
      teamId: 'team_test',
      projectId: 'prj_test',
      signal: abortController.signal,
    });
  });

  it('forwards credentials when polling for a template snapshot', async () => {
    const { sandbox: template } = makeMockSandbox({
      stop: vi.fn(async () => ({})),
    });
    const { sandbox: refreshedTemplate } = makeMockSandbox();
    const { sandbox: fork } = makeMockSandbox();
    Object.assign(template, { currentSnapshotId: undefined });
    Object.assign(refreshedTemplate, { currentSnapshotId: 'snap_123' });
    getOrCreateMock.mockResolvedValueOnce(template);
    getMock.mockResolvedValueOnce(refreshedTemplate);
    createMock.mockResolvedValueOnce(fork);
    const abortController = new AbortController();

    await createVercelSandbox({
      token: 'token_test',
      teamId: 'team_test',
      projectId: 'prj_test',
    }).createSession({
      identity: 'template-test',
      abortSignal: abortController.signal,
      onFirstCreate: async () => {},
    });

    expect(getMock).toHaveBeenCalledWith({
      name: 'ai-sdk-harness-template-test',
      resume: false,
      token: 'token_test',
      teamId: 'team_test',
      projectId: 'prj_test',
      signal: abortController.signal,
    });
  });
});
