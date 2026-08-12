import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  const calledTools = new Set<string>();

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }
      case 'tool-call': {
        calledTools.add(chunk.toolName);
        console.log(
          `TOOL CALL ${chunk.toolName} ${JSON.stringify(chunk.input)}`,
        );
        break;
      }
      case 'tool-result': {
        console.log(
          `TOOL RESULT ${chunk.toolName} ${JSON.stringify(chunk.output)}`,
        );
        break;
      }
      case 'finish': {
        console.log();
        console.log('called tools:', [...calledTools]);
        console.log(
          'cityAttractions blocked?',
          !calledTools.has('cityAttractions'),
        );
        console.log('Finish reason:', chunk.finishReason);
        console.log('Total Usage:', chunk.totalUsage);
        break;
      }
      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
