import { openai } from '@ai-sdk/openai';
import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => {
        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  callOptionsSchema: z.object({
    requestId: z.string(),
  }),
  runtimeContext: {
    requestId: 'not-set',
    completedSteps: 0,
  },
  prepareCall: ({ options, runtimeContext, ...rest }) => ({
    ...rest,
    runtimeContext: {
      ...(runtimeContext ?? {}),
      requestId: options.requestId,
      completedSteps: runtimeContext?.completedSteps ?? 0,
    },
  }),
  prepareStep: async ({ runtimeContext, steps }) => {
    console.log('prepareStep runtimeContext:', runtimeContext);

    return {
      runtimeContext: {
        ...runtimeContext,
        completedSteps: steps.length,
      },
    };
  },
  onEnd: ({ runtimeContext }) => {
    console.log('onEnd runtimeContext:', runtimeContext);
  },
  instructions: 'You are a helpful assistant.',
});

run(async () => {
  const result = await agent.generate({
    prompt: 'What is the weather in San Francisco?',
    options: {
      requestId: 'req-123',
    },
  });

  console.log(result.text);
  console.log('final runtimeContext:', result.steps.at(-1)?.runtimeContext);
});
