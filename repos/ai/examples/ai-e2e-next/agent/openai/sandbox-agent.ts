import { sandboxShellTool } from '@/tool/sandbox-shell-tool';
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';

export const sandboxAgent = new ToolLoopAgent({
  model: openai('gpt-5.5'),

  tools: {
    shell: sandboxShellTool(),
  },

  prepareCall: ({ experimental_sandbox: sandbox, ...rest }) => ({
    ...rest,
    instructions:
      `You are a helpful assistant that can run shell commands.\n` +
      `You are operating in the following sandbox: ${sandbox?.description}`,
  }),
});

export type SandboxAgentUIMessage = InferAgentUIMessage<
  typeof sandboxAgent,
  { sandboxName?: string }
>;
