import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Middleware,
} from '@ai-sdk/provider';
import type { PolicyClient } from '../policy-client';
import { evaluatePolicy } from './evaluate-policy';

/**
 * Default OPA input shape passed to the capability-scoping rule.
 * Override with `toInput` if your Rego expects a different schema.
 */
export interface DefaultOpaCapabilityInput {
  messages: LanguageModelV4CallOptions['prompt'];
  providerOptions: LanguageModelV4CallOptions['providerOptions'];
}

/**
 * Construct an experimental {@link LanguageModelV4Middleware} that narrows
 * the `tools` field on every model call to an allowlist returned by OPA.
 *
 * Why use this alongside the per-call `toolApproval` gate? Two reasons:
 *
 * 1. **Defense in depth.** If a bug or regression slips through the policy
 *    used by `toolApproval`, the middleware still prevents the model from
 *    seeing the disallowed tools in the first place.
 * 2. **Capability disclosure.** The model does not waste tokens describing
 *    tools it cannot call, and jailbreak attempts get "I don't have access
 *    to that tool" rather than "[approval denied]".
 *
 * The OPA rule at `path` is expected to return either a `string[]` of allowed
 * tool names, or an object `{ tools: string[] }`. Function tools whose `name`
 * matches are kept; provider tools whose dotted `id` or bare `name` matches are
 * kept; everything else is dropped from `params.tools`.
 *
 * On a malformed result (or an OPA error), the middleware **fails closed**:
 * `params.tools` is set to `undefined`, so the model is told it has no tools
 * available. Misconfiguration should not silently widen capabilities.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai';
 * import { wasmPolicyClient, opaCapabilityMiddleware } from '@ai-sdk/policy-opa';
 *
 * const client = await wasmPolicyClient({ wasm });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: anthropic('claude-sonnet-4-5'),
 *   middleware: opaCapabilityMiddleware({
 *     client,
 *     path: 'agent/tools/allowed',
 *   }),
 * });
 * ```
 */
export function opaCapabilityMiddleware(opts: {
  client: PolicyClient;
  path: string;
  toInput?: (args: {
    messages: LanguageModelV4CallOptions['prompt'];
    providerOptions: LanguageModelV4CallOptions['providerOptions'];
  }) => unknown;
}): LanguageModelV4Middleware {
  const { client, path, toInput } = opts;

  return {
    specificationVersion: 'v4',
    async transformParams({ params }) {
      // No tools on the call: nothing to filter.
      if (params.tools == null || params.tools.length === 0) {
        return params;
      }

      const input =
        toInput?.({
          messages: params.prompt,
          providerOptions: params.providerOptions,
        }) ??
        ({
          messages: params.prompt,
          providerOptions: params.providerOptions,
        } satisfies DefaultOpaCapabilityInput);

      // Fail closed on evaluator error or a malformed allowlist: drop all
      // tools so a misconfiguration never silently widens capabilities.
      const outcome = await evaluatePolicy(client, path, input);
      if (!outcome.ok) {
        return { ...params, tools: undefined };
      }

      const allowed = extractAllowedNameSet(outcome.result);
      if (allowed == null) {
        return { ...params, tools: undefined };
      }

      let removed = false;
      const filtered = params.tools.filter(t => {
        // Function tools are keyed by `name`. Provider tools carry both a
        // dotted `id` (`<provider>.<tool>`) and a bare `name`; match either so
        // an allowlist authored with the bare name keeps the tool instead of
        // silently dropping it.
        const keep =
          t.type === 'function'
            ? allowed.has(t.name)
            : allowed.has(t.id) || allowed.has(t.name);
        if (!keep) removed = true;
        return keep;
      });

      // Preserve object identity when nothing was dropped so downstream
      // middleware can no-op on reference equality.
      if (!removed) return params;
      return { ...params, tools: filtered };
    },
  };
}

function extractAllowedNameSet(result: unknown): Set<string> | null {
  const list = Array.isArray(result)
    ? result
    : result != null && typeof result === 'object'
      ? (result as { tools?: unknown }).tools
      : undefined;
  if (!Array.isArray(list)) return null;
  const out = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string') return null;
    out.add(item);
  }
  return out;
}
