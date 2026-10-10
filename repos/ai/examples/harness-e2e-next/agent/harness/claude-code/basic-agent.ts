import {
  HarnessAgent,
  createFileReporter,
  createTraceTreeReporter,
} from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const claudeCodeHarnessAgent = new HarnessAgent({
  harness: claudeCode,
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  /*
   * Observability wired in code — this is a dev/testing app, so no env
   * var is required. `debug: { enabled: true }` turns on bridge log forwarding
   * and the level-aware stderr default, so sandbox console output prints in the
   * `pnpm dev` terminal. The two reporters consume the same turn telemetry the
   * framework drives: the trace-tree reporter prints an ASCII span tree at turn
   * end, and the file reporter writes a unified `events.jsonl` (spans + the
   * forwarded diagnostics).
   *
   * The reporters are constructed once with the agent (module scope, shared
   * across requests), so the file reporter can't take a per-session directory
   * here — every session's turns append to the same file. We scope it to an
   * agent-specific subfolder so concurrent agents don't interleave.
   */
  debug: { enabled: true },
  telemetry: {
    integrations: [
      createTraceTreeReporter(),
      createFileReporter({ dir: '.harness-observability/claude-code/basic' }),
    ],
  },
});

/*
 * Derived from `agent.tools` directly rather than `InferAgentUIMessage<typeof
 * agent>`. The latter extracts the tool set via `AGENT extends Agent<any,
 * infer TOOLS, any>`, which infers `string` for HarnessAgent because its
 * generate/stream parameters intersect `AgentCallParameters<...>` with the
 * required-`session` extension and that disrupts structural inference. Going
 * through the `tools` field side-steps the issue while preserving the same
 * concrete UIMessage shape.
 *
 * TODO: revert to `InferAgentUIMessage<typeof claudeCodeHarnessAgent>` once
 * `session` is supported natively as part of `AgentCallParameters`, so the
 * intersection in HarnessAgent's generate/stream parameters can be dropped.
 */
export type ClaudeCodeHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof claudeCodeHarnessAgent.tools>
>;
