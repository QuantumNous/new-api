import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const openaiShellContainerAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.4'),
  instructions:
    'You have access to a shell tool running in a hosted container. ' +
    'Commands are executed server-side by OpenAI.',
  tools: {
    shell: openai.tools.shell({
      environment: {
        type: 'containerAuto',
      },
    }),
  },
});

export type OpenAIShellContainerMessage = InferAgentUIMessage<
  typeof openaiShellContainerAgent
>;
