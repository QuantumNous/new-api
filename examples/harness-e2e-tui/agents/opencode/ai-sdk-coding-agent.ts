import { HarnessAgent } from '@ai-sdk/harness/agent';
import { openCode } from '@ai-sdk/harness-opencode';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';
import {
  aiSdkCodingSandboxBootstrapHash,
  aiSdkCodingSandboxWorkDir,
  bootstrapAiSdkCodingRepo,
  refreshAiSdkCodingRepo,
} from '../../lib/ai-sdk-coding-repo';

// Default sandbox resources won't allow for a full parallel build of all packages.
// Not worth bumping all demo sandboxes' resources for just this, we can easily
// work around this by guiding the harness.
const instructions = `
Building all packages at once (e.g. running \`pnpm build\` or \`pnpm build:packages\`)
will exceed sandbox memory. When asked to do this, use the corresponding
\`pnpm exec turbo\` call directly with a lower \`--concurrency=4\` flag.
`;

export const aiSdkCodingOpenCodeHarnessAgent = new HarnessAgent({
  harness: openCode,
  instructions,
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  sandboxConfig: {
    workDir: aiSdkCodingSandboxWorkDir,
    bootstrapHash: aiSdkCodingSandboxBootstrapHash,
    onBootstrap: bootstrapAiSdkCodingRepo,
    onSession: refreshAiSdkCodingRepo,
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
 * TODO: revert to `InferAgentUIMessage<typeof aiSdkCodingOpenCodeHarnessAgent>`
 * once `session` is supported natively as part of `AgentCallParameters`, so
 * the intersection in HarnessAgent's generate/stream parameters can be
 * dropped.
 */
export type AiSdkCodingOpenCodeHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof aiSdkCodingOpenCodeHarnessAgent.tools>
>;
