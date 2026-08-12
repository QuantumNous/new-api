import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.5'),
    tools: {
      weather: weatherTool,
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    providerOptions: {
      openai: {
        allowedTools: { toolNames: ['weather'], mode: 'auto' },
      },
    },
    prompt:
      'What is the weather in San Francisco AND list 3 attractions to visit ' +
      'there. Use both the weather tool and the cityAttractions tool.',
  });

  const calledTools = new Set(result.toolCalls.map(c => c.toolName));
  console.log('called tools:', [...calledTools]);
  console.log('cityAttractions blocked?', !calledTools.has('cityAttractions'));
  console.log(JSON.stringify(result.toolCalls, null, 2));
  console.log(JSON.stringify(result.finishReason, null, 2));
});
