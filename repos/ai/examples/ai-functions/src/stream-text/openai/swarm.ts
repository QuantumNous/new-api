import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const agentA = {
    instructions: 'You are a helpful agent.',
    activeTools: ['transferToAgentB'] as 'transferToAgentB'[],
  };

  const agentB = {
    instructions: 'Only speak in Haikus.',
    activeTools: [],
  };

  let activeAgent = agentA;

  const result = streamText({
    model: openai('gpt-4o'),
    tools: {
      transferToAgentB: tool({
        description: 'Transfer to agent B.',
        inputSchema: z.object({}),
        execute: async () => {
          activeAgent = agentB;
          return 'Transferred to agent B.';
        },
      }),
    },
    stopWhen: isStepCount(5),
    prepareStep: () => activeAgent,
    prompt: 'I want to talk to agent B.',
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
});
