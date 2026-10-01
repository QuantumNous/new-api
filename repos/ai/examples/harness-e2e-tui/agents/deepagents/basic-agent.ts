import {
  createFileReporter,
  createTraceTreeReporter,
  HarnessAgent,
} from '@ai-sdk/harness/agent';
import { deepAgents } from '@ai-sdk/harness-deepagents';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const deepAgentsHarnessAgent = new HarnessAgent({
  harness: deepAgents,
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  // Observability wired in code (dev/testing app). Trace tree + diagnostics
  // print to the terminal; the file reporter writes a per-agent `events.jsonl`.
  debug: { enabled: true },
  telemetry: {
    integrations: [
      createTraceTreeReporter(),
      createFileReporter({ dir: '.harness-observability/deepagents/basic' }),
    ],
  },
});

// Derived from `agent.tools` (not InferAgentUIMessage) — see Codex/OpenCode basic agents.
export type DeepAgentsHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof deepAgentsHarnessAgent.tools>
>;
