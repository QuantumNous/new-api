import type { Context, Tool } from '@ai-sdk/provider-utils';
import type { ToolApprovalConfiguration, ToolApprovalStatus } from 'ai';

type ApprovalLiteralStatus = Extract<ToolApprovalStatus, string>;

/**
 * Result returned by {@link wrapMcpTools}: the original tool set plus a
 * `toolApproval` that falls back to a configurable default for any tool the
 * supplied approval does not explicitly handle.
 */
export interface WrappedMcpTools<
  TOOLS extends Record<string, Tool>,
  RUNTIME_CONTEXT extends Context | unknown | never,
> {
  tools: TOOLS;
  toolApproval: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>;
}

/**
 * Apply a fallback approval policy to a discovered tool set so the resulting
 * configuration is total: every tool in `tools` is gated either by the
 * supplied `approval` (when it has an opinion) or by `default` (otherwise).
 *
 * The motivating case is MCP. An MCP server hands you whatever tools it
 * exposes, and the agent's effective permissions become the union of the
 * full server surface. Without a fallback, any tool you forgot to write a
 * rule for is silently allowed. This helper closes that gap by forcing every
 * uncovered tool through `default` (which defaults to `user-approval` so the
 * human is in the loop for anything you didn't think about).
 *
 * Works for any tool set, not just MCP-discovered tools. The name reflects
 * the primary use case rather than a hard constraint.
 *
 * @example
 * ```ts
 * import { wrapMcpTools } from '@ai-sdk/policy-opa';
 * import { opaPolicy, wasmPolicyClient } from '@ai-sdk/policy-opa';
 *
 * const discovered = await mcpClient.tools();
 * const client = await wasmPolicyClient({ wasm });
 *
 * const { tools, toolApproval } = wrapMcpTools(
 *   discovered,
 *   opaPolicy({ client, path: 'agent/call/decision' }),
 *   { default: 'user-approval' }, // anything OPA does not match needs a human
 * );
 *
 * await generateText({ model, tools, toolApproval, prompt });
 * ```
 */
export function wrapMcpTools<
  TOOLS extends Record<string, Tool>,
  RUNTIME_CONTEXT extends Context | unknown | never = unknown,
>(
  tools: TOOLS,
  approval: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>,
  opts?: { default?: ApprovalLiteralStatus },
): WrappedMcpTools<TOOLS, RUNTIME_CONTEXT> {
  const fallback: ApprovalLiteralStatus = opts?.default ?? 'user-approval';

  if (typeof approval === 'function') {
    const wrapped: ToolApprovalConfiguration<
      TOOLS,
      RUNTIME_CONTEXT
    > = async args => {
      const status = await (
        approval as (a: typeof args) => Promise<unknown> | unknown
      )(args);
      return isNotApplicable(status) ? fallback : (status as never);
    };
    return { tools, toolApproval: wrapped };
  }

  // Per-tool map form: fill in any tool that the user did not list with the
  // fallback decision. We use `Object.keys(tools)` (not the approval keys) so
  // the result is total over the discovered surface.
  const filled = {} as Record<keyof TOOLS, unknown>;
  for (const name of Object.keys(tools) as Array<keyof TOOLS>) {
    filled[name] = approval[name] ?? fallback;
  }

  // `filled` is a plain per-tool map; cast to the SDK's map arm, which TS
  // can't infer from the erased `unknown` values.
  return {
    tools,
    toolApproval: filled as ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>,
  };
}

function isNotApplicable(status: unknown): boolean {
  if (status == null) return true;
  if (status === 'not-applicable') return true;
  if (typeof status === 'object' && status !== null) {
    return (status as { type?: unknown }).type === 'not-applicable';
  }
  return false;
}
