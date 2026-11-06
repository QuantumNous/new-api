import {
  loadResumeStep,
  persistResumeStep,
} from '@/util/workflow-resume-steps';
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from '@ai-sdk/workflow-harness';
import { runClaudeCodeSlice } from './run-slice-step';

/*
 * The durable `'use workflow'` function lives in its own module — NOT in
 * `route.ts` — on purpose. The Workflow DevKit bundles the module graph reachable
 * from the directive into its generated `flow`/`step` routes. `route.ts` imports
 * `ai` (`convertToModelMessages` / `createUIMessageStreamResponse`) for its POST
 * handler, and `ai` pulls in `@ai-sdk/gateway` → a lazy `@vercel/oidc` require
 * that webpack compiles into an unresolvable context module — which crashes the
 * generated step route on load. Keeping the directive in an `ai`-free module
 * (only `@ai-sdk/workflow-harness` + the step modules) keeps the DevKit bundle
 * clean, while `route.ts` stays a normal Next route where `ai` works fine.
 *
 * Each user message is one workflow run: load the prior turn's resume handle (so
 * it reattaches to the same warm session and keeps full conversation context),
 * send the new message, slice the turn across the wall-clock budget if it runs
 * long, and persist the refreshed handle for the next message. All Node-heavy
 * work lives in the step modules (`run-slice-step.ts`, `workflow-resume-steps.ts`).
 */
export async function claudeCodeCodingWorkflow(
  input: Pick<HarnessWorkflowInput, 'prompt' | 'sessionId'>,
) {
  'use workflow';

  const resumeFrom = await loadResumeStep(input.sessionId);
  let state = createHarnessWorkflowState({ ...input, resumeFrom });
  while (state.status === 'running' || state.status === 'timed_out') {
    state = await runClaudeCodeSlice(state);
  }
  await persistResumeStep(state.sessionId, state.resumeFrom);
  return finalizeHarnessWorkflow(state);
}
