import { openai } from '@ai-sdk/openai';
import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

const currentLocation = tool({
  description: 'Get the current location.',
  inputSchema: z.object({}),
  execute: async () => ({ location: 'San Francisco' }),
});

const model = openai('gpt-5-mini');

const agent = new ToolLoopAgent({
  model,
  tools: { currentLocation, weather: weatherTool },
});

run(async () => {
  const result = await agent.stream({
    prompt: 'What is the weather in my current location?',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  print(
    'Step performance:',
    (await result.steps).map(step => step.performance),
  );
  print('Final step performance:', (await result.finalStep).performance);
  print('Total usage:', await result.usage);
});
