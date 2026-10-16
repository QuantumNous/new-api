import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-nano'),
    stopWhen: isStepCount(3),
    maxRetries: 0,
    tools: {
      currentLocation: tool({
        description: 'Get the current location.',
        inputSchema: z.object({}),
        execute: async () => ({ location: 'San Francisco' }),
      }),
      weather: weatherTool,
    },
    prompt: 'What is the weather in my current location?',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-input-start': {
        console.log(`\nTool call: ${chunk.toolName}`);
        process.stdout.write('Tool input: ');
        break;
      }

      case 'tool-input-delta': {
        process.stdout.write(chunk.delta);
        break;
      }

      case 'tool-input-end': {
        console.log();
        break;
      }

      case 'tool-result': {
        print('Tool result:', chunk.output);
        break;
      }

      case 'finish-step': {
        console.log('\nStep finished');
        print('Usage:', chunk.usage);
        break;
      }

      case 'error': {
        console.error('Error:', chunk.error);
        break;
      }
    }
  }

  print(
    'Step performance:',
    (await result.steps).map(step => step.performance),
  );
  print('Final step performance:', (await result.finalStep).performance);
  print('Total usage:', await result.usage);
});
