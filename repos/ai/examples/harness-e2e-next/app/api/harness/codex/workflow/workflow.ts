import {
  loadResumeStep,
  persistResumeStep,
} from '@/util/workflow-resume-steps';
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from '@ai-sdk/workflow-harness';
import { runCodexSlice } from './run-slice-step';

/*
 * The durable `'use workflow'` function lives in its own module — NOT in
 * `route.ts`. The Workflow DevKit bundles the module graph reachable from the
 * directive into its generated `flow`/`step` routes; `route.ts` imports `ai`
 * (which pulls `@ai-sdk/gateway` → a lazy `@vercel/oidc` require webpack cannot
 * resolve, crashing the step route on load). Keeping the directive in an
 * `ai`-free module keeps the DevKit bundle clean. See the claude-code workflow
 * module for the full rationale.
 */
export async function codexCodingWorkflow(
  input: Pick<HarnessWorkflowInput, 'prompt' | 'sessionId'>,
) {
  'use workflow';

  const resumeFrom = await loadResumeStep(input.sessionId);
  let state = createHarnessWorkflowState({ ...input, resumeFrom });
  while (state.status === 'running' || state.status === 'timed_out') {
    state = await runCodexSlice(state);
  }
  await persistResumeStep(state.sessionId, state.resumeFrom);
  return finalizeHarnessWorkflow(state);
}
