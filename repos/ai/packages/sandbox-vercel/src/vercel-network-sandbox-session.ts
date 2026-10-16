import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkPolicy,
  type HarnessV1NetworkSandboxSession,
} from '@ai-sdk/harness';
import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import type { Sandbox, NetworkPolicy } from '@vercel/sandbox';
import { VercelSandboxSession } from './vercel-sandbox-session';

const VERCEL_PROVIDER_ID = 'vercel-sandbox';

/**
 * `HarnessV1NetworkSandboxSession` backed by a `@vercel/sandbox` `Sandbox`. The
 * provider's `create()` returns one of these. It extends
 * {@link VercelSandboxSession} with the infra surface (ports, lifecycle,
 * network policy). It owns the sandbox's lifecycle only when the provider
 * created it; when the provider was given an existing sandbox, `stop()` and
 * `destroy()` are no-ops (caller retains ownership).
 */
export class VercelNetworkSandboxSession
  extends VercelSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  private readonly ownsLifecycle: boolean;

  constructor(input: { sandbox: Sandbox; ownsLifecycle: boolean }) {
    super(input.sandbox);
    this.ownsLifecycle = input.ownsLifecycle;
    this.id = input.sandbox.name;
    this.defaultWorkingDirectory = input.sandbox.currentSession().cwd;
  }

  get ports(): ReadonlyArray<number> {
    return this.sandbox.routes.map(route => route.port);
  }

  restricted(): SandboxSession {
    return new VercelSandboxSession(this.sandbox);
  }

  getPortUrl = async (options: {
    port: number;
    protocol?: 'http' | 'https' | 'ws';
  }): Promise<string> => {
    const exposedPorts = this.ports;
    if (!exposedPorts.includes(options.port)) {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: VERCEL_PROVIDER_ID,
        message: `Port ${options.port} is not exposed on this sandbox. Exposed ports: [${exposedPorts.join(', ')}].`,
      });
    }
    const protocol = options.protocol ?? 'https';
    const url = new URL(this.sandbox.domain(options.port));
    const isSecure = url.protocol === 'https:';
    switch (protocol) {
      case 'http':
        url.protocol = isSecure ? 'https:' : 'http:';
        break;
      case 'https':
        url.protocol = 'https:';
        break;
      case 'ws':
        url.protocol = isSecure ? 'wss:' : 'ws:';
        break;
    }
    return url.toString();
  };

  setNetworkPolicy = async (policy: HarnessV1NetworkPolicy): Promise<void> => {
    await this.sandbox.update({ networkPolicy: toVercelPolicy(policy) });
  };

  setPorts = async (
    ports: ReadonlyArray<number>,
    options?: { abortSignal?: AbortSignal },
  ): Promise<void> => {
    await this.sandbox.update(
      { ports: [...ports] },
      options?.abortSignal ? { signal: options.abortSignal } : undefined,
    );
  };

  stop = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    await this.sandbox.stop();
  };

  destroy = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    await this.sandbox.stop().catch(() => {});
    await this.sandbox.delete();
  };
}

export function toVercelPolicy(policy: HarnessV1NetworkPolicy): NetworkPolicy {
  switch (policy.mode) {
    case 'allow-all':
      return 'allow-all';
    case 'deny-all':
      return 'deny-all';
    case 'custom': {
      const result: Extract<NetworkPolicy, { allow?: unknown }> = {};
      const { allowedHosts, allowedCIDRs, deniedCIDRs } = policy;
      if (allowedHosts != null && allowedHosts.length > 0) {
        result.allow = [...allowedHosts];
      }
      if (
        (allowedCIDRs != null && allowedCIDRs.length > 0) ||
        (deniedCIDRs != null && deniedCIDRs.length > 0)
      ) {
        result.subnets = {
          ...(allowedCIDRs != null && allowedCIDRs.length > 0
            ? { allow: [...allowedCIDRs] }
            : {}),
          ...(deniedCIDRs != null && deniedCIDRs.length > 0
            ? { deny: [...deniedCIDRs] }
            : {}),
        };
      }
      if (result.allow == null && result.subnets == null) {
        throw new HarnessCapabilityUnsupportedError({
          harnessId: VERCEL_PROVIDER_ID,
          message:
            'Custom network policy requires at least one of allowedHosts or allowedCIDRs to be non-empty.',
        });
      }
      return result;
    }
  }
}
