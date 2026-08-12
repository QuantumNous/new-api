import { xai } from '@ai-sdk/xai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai.responses('grok-4-1-fast-reasoning'),
    maxOutputTokens: 512,
    tools: {
      weather: weatherTool,
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  for await (const event of result.stream) {
    switch (event.type) {
      case 'text-delta': {
        process.stdout.write(event.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\nTool call: '${event.toolName}' ${JSON.stringify(event.input)}`,
        );
        break;
      }

      case 'tool-result': {
        if (event.dynamic) {
          continue;
        }

        console.log(
          `\nTool response: '${event.toolName}' ${JSON.stringify(event.output)}`,
        );
        break;
      }
    }
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
