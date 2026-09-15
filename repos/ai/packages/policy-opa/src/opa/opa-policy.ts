import type {
  Context,
  InferToolSetContext,
  ModelMessage,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { ToolApprovalConfiguration } from 'ai';
import type { PolicyClient } from '../policy-client';
import { evaluatePolicy } from './evaluate-policy';
import { normalizeOpaDecision } from './normalize-opa-decision';

/**
 * The default shape passed to the OPA rule as `input` when no `toInput` is
 * supplied. Rego rules can read `input.tool.name`, `input.args`, and so on.
 */
export interface DefaultOpaInput {
  tool: { name: string };
  args: unknown;
  messages: ReadonlyArray<ModelMessage>;
  runtimeContext: unknown;
}

/**
 * Construct a {@link ToolApprovalConfiguration} backed by an OPA policy.
 *
 * The returned generic approval function evaluates the supplied Rego entry
 * (`path`) for every tool call and maps the result to the SDK's approval
 * status via {@link normalizeOpaDecision}. Pass the result directly as
 * `toolApproval` on `generateText` / `streamText` / `ToolLoopAgent`.
 *
 * ```ts
 * import { wasmPolicyClient } from '@ai-sdk/policy-opa';
 * import { opaPolicy } from '@ai-sdk/policy-opa';
 *
 * const client = await wasmPolicyClient({ wasm });
 * const toolApproval = opaPolicy({ client, path: 'agent/call/decision' });
 *
 * await generateText({ model, tools, toolApproval, prompt });
 * ```
 *
 * @param opts.client    The OPA client (HTTP or WASM).
 * @param opts.path      The Rego entrypoint that returns the decision object.
 * @param opts.toInput   Optional transformer to shape the OPA input.
 */
export function opaPolicy<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context | unknown | never = unknown,
>(opts: {
  client: PolicyClient;
  path: string;
  toInput?: (args: {
    toolCall: { toolName: string; toolCallId: string; input: unknown };
    tools: TOOLS | undefined;
    toolsContext: InferToolSetContext<TOOLS>;
    runtimeContext: RUNTIME_CONTEXT;
    messages: ModelMessage[];
  }) => unknown;
}): ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT> {
  const { client, path, toInput } = opts;

  return async ({
    toolCall,
    tools,
    toolsContext,
    runtimeContext,
    messages,
  }) => {
    const opaInput =
      toInput?.({ toolCall, tools, toolsContext, runtimeContext, messages }) ??
      ({
        tool: { name: toolCall.toolName },
        args: toolCall.input,
        messages,
        runtimeContext,
      } satisfies DefaultOpaInput);

    // Fail closed: a backend error must not be read as "no opinion". Deny so
    // the model sees a structured result it can reason about, rather than the
    // error rejecting out of the callback and aborting the run.
    const outcome = await evaluatePolicy(client, path, opaInput);
    if (!outcome.ok) {
      return {
        type: 'denied',
        reason: `policy evaluation failed: ${errorMessage(outcome.error)}`,
      };
    }

    return normalizeOpaDecision(outcome.result);
  };
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'object' && cause !== null) {
    try {
      return JSON.stringify(cause);
    } catch {
      // Fall through for circular / non-serializable objects.
    }
  }
  return String(cause);
}

/**
 * Optional variant of {@link opaPolicy} that gracefully degrades when no
 * policy backend is available.
 *
 * Returns `undefined` when `client` is `undefined`. Pass that directly as
 * `toolApproval` and the SDK falls back to its default allow-all behavior.
 * When `client` is supplied, behaves exactly like {@link opaPolicy}.
 *
 * Use this when the policy file is configured per environment (e.g. loaded
 * in production, absent in local development):
 *
 * ```ts
 * import { readFile } from 'node:fs/promises';
 * import { optionalOpaPolicy, wasmPolicyClient } from '@ai-sdk/policy-opa';
 *
 * const wasm = process.env.POLICY_WASM_PATH
 *   ? await readFile(process.env.POLICY_WASM_PATH)
 *   : undefined;
 * const client = wasm ? await wasmPolicyClient({ wasm }) : undefined;
 *
 * const toolApproval = optionalOpaPolicy({
 *   client,
 *   path: 'agent/call/decision',
 * });
 *
 * await generateText({ model, tools, toolApproval, prompt });
 * ```
 */
export function optionalOpaPolicy<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context | unknown | never = unknown,
>(opts: {
  client: PolicyClient | undefined;
  path: string;
  toInput?: (args: {
    toolCall: { toolName: string; toolCallId: string; input: unknown };
    tools: TOOLS | undefined;
    toolsContext: InferToolSetContext<TOOLS>;
    runtimeContext: RUNTIME_CONTEXT;
    messages: ModelMessage[];
  }) => unknown;
}): ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT> | undefined {
  if (opts.client == null) return undefined;
  return opaPolicy<TOOLS, RUNTIME_CONTEXT>({
    client: opts.client,
    path: opts.path,
    toInput: opts.toInput,
  });
}
