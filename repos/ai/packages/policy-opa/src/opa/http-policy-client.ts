import type { PolicyClient } from '../policy-client';

/**
 * Construct a {@link PolicyClient} that talks to a running OPA server over
 * HTTP using `@open-policy-agent/opa`.
 *
 * The `@open-policy-agent/opa` package is an optional peer dependency; install
 * it before using this client:
 *
 * ```sh
 * pnpm add @open-policy-agent/opa
 * ```
 *
 * The `url` typically points at `http://localhost:8181` for a locally running
 * OPA. `headers` is forwarded for Styra DAS / EOPA authentication.
 */
export function httpPolicyClient(opts: {
  url: string;
  headers?: Record<string, string>;
}): PolicyClient {
  const { url, headers } = opts;
  type Underlying = {
    evaluate(path: string, input: unknown): Promise<unknown>;
  };
  type OPAModule = {
    OPAClient: new (
      url: string,
      opts?: { headers?: Record<string, string> },
    ) => Underlying;
  };

  let underlying: Underlying | undefined;

  async function getUnderlying(): Promise<Underlying> {
    if (underlying) return underlying;
    let mod: OPAModule;
    try {
      mod = (await import('@open-policy-agent/opa')) as unknown as OPAModule;
    } catch (cause) {
      throw Object.assign(
        new Error(
          'Cannot import "@open-policy-agent/opa". Install it as a peer dependency to use httpPolicyClient().',
        ),
        { cause },
      );
    }
    underlying = new mod.OPAClient(url, headers ? { headers } : undefined);
    return underlying;
  }

  return {
    async evaluate(path, input) {
      const client = await getUnderlying();
      return (await client.evaluate(path, input)) as never;
    },
  };
}
