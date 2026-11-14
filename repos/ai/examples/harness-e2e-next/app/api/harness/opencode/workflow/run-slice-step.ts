import {
  runHarnessAgentSlice,
  type HarnessWorkflowState,
} from '@ai-sdk/workflow-harness';

/*
 * Slice step in its own step-only module; the agent is dynamically imported
 * inside the step body so it (and its `@vercel/sandbox` deps) stay out of the
 * workflow bundle's restricted runtime. See the claude-code slice step for the
 * full rationale.
 *
 * Demo budget lowered from the 750s production default so slicing is observable.
 */
const DEMO_SLICE_TIMEOUT_SECONDS = 30;

export async function runOpenCodeSlice(
  state: HarnessWorkflowState,
): Promise<HarnessWorkflowState> {
  'use step';

  const { openCodeHarnessAgent } =
    await import('@/agent/harness/opencode/basic-agent');
  return runHarnessAgentSlice({
    agent: openCodeHarnessAgent,
    state,
    sliceTimeoutSeconds: DEMO_SLICE_TIMEOUT_SECONDS,
  });
}
