# @ai-sdk/workflow-harness

Run an AI SDK `HarnessAgent` (Claude Code, Codex, Pi) as a **durable workflow**
using the [Workflow DevKit](https://www.npmjs.com/package/workflow).

A long agent turn is sliced into short, time-boxed steps so it survives a Fluid
Compute function recycle (~800s). Between slices the agent is frozen
non-destructively — the sandbox keeps running and the next slice reattaches to
the in-flight turn (`attach`) — and a serializable state object is persisted as
the durable step return value.

This package ships plain helpers + a serializable state machine; you own the
thin `'use workflow'` / `'use step'` wrappers (the Workflow DevKit compiles
those directives in your app).

Keep the Workflow DevKit entrypoints separate from the agent definition. The
workflow module should import only workflow-safe code plus step modules. The
step module should dynamically import the agent inside the `'use step'` body so
the agent, sandbox provider, and other Node-heavy dependencies stay out of the
compiled workflow bundle.

`agent.ts`:

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

export const agent = new HarnessAgent({
  harness: claudeCode,
  sandbox: createVercelSandbox({ runtime: 'node24', ports: [4000] }),
});
```

`run-slice-step.ts`:

```ts
import {
  runHarnessAgentSlice,
  type HarnessWorkflowState,
} from '@ai-sdk/workflow-harness';

export async function runSlice(
  state: HarnessWorkflowState,
): Promise<HarnessWorkflowState> {
  'use step';

  const { agent } = await import('./agent');
  return runHarnessAgentSlice({ agent, state });
}
```

`workflow.ts`:

```ts
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from '@ai-sdk/workflow-harness';
import { runSlice } from './run-slice-step';

export async function codingWorkflow(input: {
  prompt: HarnessWorkflowInput['prompt'];
  sessionId: string;
}) {
  'use workflow';

  let state = createHarnessWorkflowState(input);
  while (state.status === 'running' || state.status === 'timed_out') {
    state = await runSlice(state);
  }
  return finalizeHarnessWorkflow(state);
}
```

`route.ts` (Next.js example):

```ts
import { start } from 'workflow/api';
import { codingWorkflow } from './workflow';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt: string;
    sessionId: string;
  };
  const run = await start(codingWorkflow, [body]);

  return new Response(run.readable);
}
```
