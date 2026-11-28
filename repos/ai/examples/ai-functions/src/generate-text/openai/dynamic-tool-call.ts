import { openai } from '@ai-sdk/openai';
import { dynamicTool, generateText, isStepCount, type ToolSet } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

function dynamicTools(): ToolSet {
  return {
    currentLocation: dynamicTool({
      description: 'Get the current location.',
      inputSchema: z.object({}),
      execute: async () => {
        const locations = ['New York', 'London', 'Paris'];
        return {
          location: locations[Math.floor(Math.random() * locations.length)],
        };
      },
    }),
  };
}

run(async () => {
  const result = await generateText({
    model: openai('gpt-4o'),
    stopWhen: isStepCount(5),
    tools: {
      ...dynamicTools(),
      weather: weatherTool,
    },
    prompt: 'What is the weather in my current location?',
    onStepFinish: step => {
      // typed tool calls:
      for (const toolCall of step.toolCalls) {
        if (toolCall.dynamic) {
          console.log('DYNAMIC CALL', JSON.stringify(toolCall, null, 2));
          continue;
        }

        switch (toolCall.toolName) {
          case 'weather': {
            console.log('STATIC CALL', JSON.stringify(toolCall, null, 2));
            toolCall.input.location; // string
            break;
          }
        }
      }

      // typed tool results for tools with execute method:
      for (const toolResult of step.toolResults) {
        if (toolResult.dynamic) {
          console.log('DYNAMIC RESULT', JSON.stringify(toolResult, null, 2));
          continue;
        }

        switch (toolResult.toolName) {
          case 'weather': {
            console.log('STATIC RESULT', JSON.stringify(toolResult, null, 2));
            toolResult.input.location; // string
            toolResult.output.location; // string
            toolResult.output.temperature; // number
            break;
          }
        }
      }
    },
  });

  console.log(JSON.stringify(result.content, null, 2));
});
