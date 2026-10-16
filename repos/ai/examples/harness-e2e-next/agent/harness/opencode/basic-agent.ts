import {
  HarnessAgent,
  createFileReporter,
  createTraceTreeReporter,
} from '@ai-sdk/harness/agent';
import { openCode } from '@ai-sdk/harness-opencode';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const openCodeHarnessAgent = new HarnessAgent({
  harness: openCode,
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  // Observability wired in code (dev/testing app). Trace tree + diagnostics
  // print to the `pnpm dev` terminal; the file reporter writes a per-agent
  // `events.jsonl`.
  debug: { enabled: true },
  telemetry: {
    integrations: [
      createTraceTreeReporter(),
      createFileReporter({ dir: '.harness-observability/opencode/basic' }),
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
 * TODO: revert to `InferAgentUIMessage<typeof openCodeHarnessAgent>` once
 * `session` is supported natively as part of `AgentCallParameters`, so the
 * intersection in HarnessAgent's generate/stream parameters can be dropped.
 */
export type OpenCodeHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof openCodeHarnessAgent.tools>
>;
