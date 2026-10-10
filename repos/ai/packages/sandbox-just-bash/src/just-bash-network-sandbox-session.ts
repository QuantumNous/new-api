import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkSandboxSession,
} from '@ai-sdk/harness';
import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { randomUUID } from 'node:crypto';
import type { Sandbox } from 'just-bash';
import { JustBashSandboxSession } from './just-bash-sandbox-session';

const JUST_BASH_PROVIDER_ID = 'just-bash-sandbox';

/**
 * `HarnessV1NetworkSandboxSession` backed by a `just-bash` `Sandbox`. It extends
 * {@link JustBashSandboxSession} with the infra surface. Exposes no ports —
 * there is no network namespace and no way to publish an HTTP endpoint
 * reachable from outside the host process. Bridge-backed harness adapters that
 * need `getPortUrl` will fail with `HarnessCapabilityUnsupportedError` at start.
 *
 * Network policy is not implementable locally either — `setNetworkPolicy` is
 * omitted.
 */
export class JustBashNetworkSandboxSession
  extends JustBashSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  /**
   * Minted at construct time. just-bash has no native identifier and no
   * cross-process reattach surface; the value exists only to satisfy the
   * `HarnessV1NetworkSandboxSession.id` contract.
   */
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  private readonly ownsLifecycle: boolean;

  constructor(input: { sandbox: Sandbox; ownsLifecycle: boolean }) {
    super(input.sandbox);
    this.ownsLifecycle = input.ownsLifecycle;
    this.id = randomUUID();
    this.defaultWorkingDirectory = input.sandbox.bashEnvInstance.getCwd();
  }

  readonly ports: ReadonlyArray<number> = [];

  restricted(): SandboxSession {
    return new JustBashSandboxSession(this.sandbox);
  }

  getPortUrl = async (_options: {
    port: number;
    protocol?: 'http' | 'https' | 'ws';
  }): Promise<string> => {
    throw new HarnessCapabilityUnsupportedError({
      harnessId: JUST_BASH_PROVIDER_ID,
      message:
        'just-bash sandboxes run in-process and cannot expose a port URL. ' +
        'Use a hosted sandbox (e.g. @ai-sdk/sandbox-vercel) for bridge-backed harness adapters.',
    });
  };

  stop = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    // just-bash has no explicit shutdown; the sandbox is garbage-collected
    // along with its in-memory filesystem once references drop.
  };

  destroy = async (): Promise<void> => {
    await this.stop();
  };
}
