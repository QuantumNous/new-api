import type {
  HarnessV1NetworkSandboxSession,
  HarnessV1SandboxProvider,
} from '@ai-sdk/harness';
import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { Sandbox } from '@vercel/sandbox';
import { VercelNetworkSandboxSession } from './vercel-network-sandbox-session';
import { VercelSandboxSession } from './vercel-sandbox-session';

/**
 * Flattens an intersection of object types into a single object type so the
 * resolved shape displays as its named properties rather than a chain of
 * `A & B & C`.
 */
type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Distributes `Omit` across each member of a union instead of collapsing the
 * union to its common keys. `Sandbox.create`'s parameter is a union (a
 * git/tarball/no-source create variant and a snapshot-source create variant),
 * so a plain `Omit` would discard keys absent from any one member (e.g.
 * `runtime`, which the snapshot variant lacks) and merge the `source` shapes.
 * Applying `Omit` per-member preserves every variant intact; the `Prettify`
 * wrapper collapses each member's intersections into a readable object shape.
 */
type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Prettify<Omit<T, K>>
  : never;

/**
 * Parameters forwarded to `@vercel/sandbox`'s `Sandbox.create` when creating
 * a sandbox from scratch. Aliased directly from the underlying SDK so the
 * full surface — every option Vercel supports, including its native
 * `NetworkPolicy` — is available without us re-declaring it.
 */
type VercelSandboxCreateParams = DistributiveOmit<
  NonNullable<Parameters<typeof Sandbox.create>[0]>,
  'onResume'
>;

/**
 * Settings for {@link createVercelSandbox}. Two mutually-exclusive shapes:
 *
 * - `{ sandbox }` — wrap an already-created `@vercel/sandbox` `Sandbox`. The
 *   caller owns its lifecycle; the provider's `stop()` and `destroy()` are
 *   no-ops. Optionally declare `bridgePorts` to give the harness a port pool to
 *   lease from for concurrent sessions on the same provided sandbox.
 * - {@link VercelSandboxCreateParams} fields — provider creates the underlying
 *   sandbox. When the adapter declares a bootstrap recipe the provider uses
 *   `Sandbox.getOrCreate` to maintain a persistent named template snapshot
 *   keyed by the recipe identity, and forks an ephemeral sandbox per session
 *   from the snapshot. Use `name` to override the auto-derived template name.
 */
export type VercelSandboxSettings =
  | {
      sandbox: Sandbox;
      bridgePorts?: ReadonlyArray<number>;
    }
  | (VercelSandboxCreateParams & {
      sandbox?: never;
      name?: string;
    });

/**
 * 30 minutes. The `@vercel/sandbox` SDK defaults to 5 minutes which is
 * too short for multi-step workflows — the VM expires between steps.
 */
const DEFAULT_SANDBOX_TIMEOUT_MS = 30 * 60 * 1_000;

const VERCEL_PROVIDER_ID = 'vercel-sandbox';
const TEMPLATE_NAME_PREFIX = 'ai-sdk-harness';
const SESSION_NAME_PREFIX = 'ai-sdk-harness-session';
const SNAPSHOT_POLL_INTERVAL_MS = 500;
const SNAPSHOT_POLL_TIMEOUT_MS = 30_000;

function sessionSandboxName(sessionId: string): string {
  return `${SESSION_NAME_PREFIX}-${sessionId}`;
}

export function createVercelSandbox(
  settings: VercelSandboxSettings = {} as VercelSandboxSettings,
): HarnessV1SandboxProvider {
  return new VercelSandboxProvider(settings);
}

/**
 * `HarnessV1SandboxProvider` implementation backed by `@vercel/sandbox`.
 * Construct one via {@link createVercelSandbox} at module scope and pass it
 * to a `HarnessAgent` (or call `createSession()` directly if you want raw
 * access to a network sandbox session).
 */
export class VercelSandboxProvider implements HarnessV1SandboxProvider {
  readonly specificationVersion = 'harness-sandbox-v1' as const;
  readonly providerId = VERCEL_PROVIDER_ID;
  readonly bridgePorts?: ReadonlyArray<number>;

  constructor(private readonly settings: VercelSandboxSettings) {
    if (
      'sandbox' in settings &&
      settings.sandbox != null &&
      settings.bridgePorts != null &&
      settings.bridgePorts.length > 0
    ) {
      this.bridgePorts = [...settings.bridgePorts];
    }
  }

  createSession = async (options?: {
    sessionId?: string;
    abortSignal?: AbortSignal;
    identity?: string;
    onFirstCreate?: (
      session: SandboxSession,
      opts: { abortSignal?: AbortSignal },
    ) => Promise<void>;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options?.abortSignal?.throwIfAborted();

    if ('sandbox' in this.settings && this.settings.sandbox != null) {
      return new VercelNetworkSandboxSession({
        sandbox: this.settings.sandbox,
        ownsLifecycle: false,
      });
    }

    type CreateNewBranch = BaseCreateSandboxParams & {
      sandbox?: never;
      name?: string;
    };
    const settings = this.settings as CreateNewBranch;
    const {
      sandbox: _ignoredSandbox,
      name: explicitName,
      ...createParams
    } = settings;
    const baseParams: BaseCreateSandboxParams = {
      ...createParams,
      timeout: createParams.timeout ?? DEFAULT_SANDBOX_TIMEOUT_MS,
    };

    const identity = options?.identity;
    const onFirstCreate = options?.onFirstCreate;

    // When sessionId is supplied, name the per-session sandbox deterministically
    // so a future `resumeSession({ sessionId })` can locate it via
    // `Sandbox.get({ name })`. Absent sessionId (e.g. prewarm), fall back to
    // Vercel's auto-naming.
    const sessionNameOverride = options?.sessionId
      ? { name: sessionSandboxName(options.sessionId) }
      : {};

    if (identity == null || onFirstCreate == null) {
      const sandbox = await Sandbox.create({
        ...baseParams,
        ...sessionNameOverride,
        ...(options?.abortSignal ? { signal: options.abortSignal } : {}),
      });
      return new VercelNetworkSandboxSession({ sandbox, ownsLifecycle: true });
    }

    const templateName = explicitName ?? `${TEMPLATE_NAME_PREFIX}-${identity}`;
    const cache = getSnapshotCache();
    let snapshotId = cache.get(templateName);

    if (snapshotId == null) {
      const template = await Sandbox.getOrCreate({
        ...baseParams,
        name: templateName,
        persistent: true,
        snapshotExpiration: baseParams.snapshotExpiration ?? 0,
        onCreate: async sbx => {
          await onFirstCreate(new VercelSandboxSession(sbx), {
            abortSignal: options?.abortSignal,
          });
        },
        ...(options?.abortSignal ? { signal: options.abortSignal } : {}),
      });

      let resolvedId: string | undefined = template.currentSnapshotId;
      if (resolvedId == null) {
        const stopResult = await template.stop(
          options?.abortSignal ? { signal: options.abortSignal } : undefined,
        );
        resolvedId = stopResult.snapshot?.id;
        if (resolvedId == null) {
          resolvedId = await pollForTemplateSnapshot(
            templateName,
            options?.abortSignal,
          );
        }
      }

      cache.set(templateName, resolvedId);
      snapshotId = resolvedId;
    }

    const {
      runtime: _ignoredRuntime,
      source: _ignoredSource,
      persistent: _ignoredPersistent,
      ...forkParams
    } = baseParams;

    const fork = await Sandbox.create({
      ...forkParams,
      source: { type: 'snapshot', snapshotId },
      ...sessionNameOverride,
      ...(options?.abortSignal ? { signal: options.abortSignal } : {}),
    });
    return new VercelNetworkSandboxSession({
      sandbox: fork,
      ownsLifecycle: true,
    });
  };

  resumeSession = async (options: {
    sessionId: string;
    abortSignal?: AbortSignal;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options.abortSignal?.throwIfAborted();

    // Wrap-existing case: caller owns the sandbox. Same session as createSession.
    if ('sandbox' in this.settings && this.settings.sandbox != null) {
      return new VercelNetworkSandboxSession({
        sandbox: this.settings.sandbox,
        ownsLifecycle: false,
      });
    }

    const sandbox = await Sandbox.get({
      name: sessionSandboxName(options.sessionId),
      ...(options.abortSignal ? { signal: options.abortSignal } : {}),
    });
    return new VercelNetworkSandboxSession({ sandbox, ownsLifecycle: true });
  };
}

/**
 * Base shape of `Sandbox.create` params extracted from the union (excludes
 * the `source: { type: 'snapshot' }` variant) so all create-time fields
 * are typed as present.
 */
type BaseCreateSandboxParams = Exclude<
  VercelSandboxCreateParams,
  { source: { type: 'snapshot'; snapshotId: string } }
>;

const SNAPSHOT_CACHE_KEY = Symbol.for(
  'ai-sdk.harness.vercel-template-snapshots',
);

type SnapshotCache = Map<string, string>;

function getSnapshotCache(): SnapshotCache {
  const globals = globalThis as {
    [SNAPSHOT_CACHE_KEY]?: SnapshotCache;
  };
  let cache = globals[SNAPSHOT_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    globals[SNAPSHOT_CACHE_KEY] = cache;
  }
  return cache;
}

async function pollForTemplateSnapshot(
  name: string,
  abortSignal: AbortSignal | undefined,
): Promise<string> {
  const deadline = Date.now() + SNAPSHOT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    abortSignal?.throwIfAborted();
    const refreshed = await Sandbox.get({
      name,
      resume: false,
      ...(abortSignal ? { signal: abortSignal } : {}),
    });
    if (refreshed.currentSnapshotId) {
      return refreshed.currentSnapshotId;
    }
    await new Promise<void>(resolve =>
      setTimeout(resolve, SNAPSHOT_POLL_INTERVAL_MS),
    );
  }
  throw new Error(
    `Timed out waiting for snapshot of template "${name}" to publish.`,
  );
}
