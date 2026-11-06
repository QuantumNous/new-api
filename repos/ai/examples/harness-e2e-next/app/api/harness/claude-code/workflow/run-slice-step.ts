import {
  runHarnessAgentSlice,
  type HarnessWorkflowState,
} from '@ai-sdk/workflow-harness';

/*
 * The slice step lives in its own step-only module and the agent is imported
 * dynamically inside the step body. The Workflow DevKit stubs each `'use step'`
 * in the workflow bundle, so a dynamic import inside the body is dropped from
 * it — keeping the agent and its `@vercel/sandbox` deps (which use Node APIs)
 * out of the no-`require` workflow runtime. A static top-level import can't be:
 * importing the agent module runs `createVercelSandbox(...)` at load (a side
 * effect that can't be tree-shaken), dragging those deps into the bundle.
 *
 * Demo budget: production defaults to 750s (just under Fluid Compute's ~800s
 * recycle); lowered here so a multi-step turn visibly freezes at the slice
 * boundary and the next step reattaches without a long wait.
 */
const DEMO_SLICE_TIMEOUT_SECONDS = 30;

export async function runClaudeCodeSlice(
  state: HarnessWorkflowState,
): Promise<HarnessWorkflowState> {
  'use step';

  const { claudeCodeHarnessAgent } =
    await import('@/agent/harness/claude-code/basic-agent');
  return runHarnessAgentSlice({
    agent: claudeCodeHarnessAgent,
    state,
    sliceTimeoutSeconds: DEMO_SLICE_TIMEOUT_SECONDS,
  });
}
