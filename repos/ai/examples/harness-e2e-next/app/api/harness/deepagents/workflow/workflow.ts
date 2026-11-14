import {
  loadResumeStep,
  persistResumeStep,
} from '@/util/workflow-resume-steps';
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from '@ai-sdk/workflow-harness';
import { runDeepAgentsSlice } from './run-slice-step';

// The `'use workflow'` function lives in its own `ai`-free module (not `route.ts`) so the DevKit's generated step/flow bundle doesn't pull in `@ai-sdk/gateway`/`@vercel/oidc` and crash. See the claude-code workflow module for the full rationale.
export async function deepAgentsCodingWorkflow(
  input: Pick<HarnessWorkflowInput, 'prompt' | 'sessionId'>,
) {
  'use workflow';

  const resumeFrom = await loadResumeStep(input.sessionId);
  let state = createHarnessWorkflowState({ ...input, resumeFrom });
  while (state.status === 'running' || state.status === 'timed_out') {
    state = await runDeepAgentsSlice(state);
  }
  await persistResumeStep(state.sessionId, state.resumeFrom);
  return finalizeHarnessWorkflow(state);
}
