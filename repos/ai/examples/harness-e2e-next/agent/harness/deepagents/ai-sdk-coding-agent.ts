import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createDeepAgents } from '@ai-sdk/harness-deepagents';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';
import {
  aiSdkCodingSandboxBootstrapHash,
  aiSdkCodingSandboxWorkDir,
  bootstrapAiSdkCodingRepo,
  refreshAiSdkCodingRepo,
} from '../ai-sdk-coding-repo';

// Default sandbox resources won't allow a full parallel build of all packages;
// guide the harness to use a lower turbo concurrency instead.
const instructions = `
Building all packages at once (e.g. running \`pnpm build\` or \`pnpm build:packages\`)
will exceed sandbox memory. When asked to do this, use the corresponding
\`pnpm exec turbo\` call directly with a lower \`--concurrency=4\` flag.
`;

export const aiSdkCodingDeepAgentsHarnessAgent = new HarnessAgent({
  harness: createDeepAgents({ recursionLimit: 200 }),
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

// See basic-agent.ts for why the UIMessage type derives from agent.tools.
export type AiSdkCodingDeepAgentsHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof aiSdkCodingDeepAgentsHarnessAgent.tools>
>;
