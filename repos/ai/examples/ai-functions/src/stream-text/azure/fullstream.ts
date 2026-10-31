import { azure } from '@ai-sdk/azure';
import { streamText } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: azure('gpt-4.1-mini'), // use your own deployment
    tools: {
      weather: weatherTool,
      cityAttractions: {
        inputSchema: z.object({ city: z.string() }),
      },
    },
    prompt: 'What is the weather in San Francisco?',
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta': {
        console.log('Text:', part.text);
        break;
      }

      case 'tool-call': {
        if (part.dynamic) {
          continue;
        }

        switch (part.toolName) {
          case 'cityAttractions': {
            console.log('TOOL CALL cityAttractions');
            console.log(`city: ${part.input.city}`); // string
            break;
          }

          case 'weather': {
            console.log('TOOL CALL weather');
            console.log(`location: ${part.input.location}`); // string
            break;
          }
        }

        break;
      }

      case 'tool-result': {
        if (part.dynamic) {
          continue;
        }

        switch (part.toolName) {
          // NOT AVAILABLE (NO EXECUTE METHOD)
          // case 'cityAttractions': {
          //   console.log('TOOL RESULT cityAttractions');
          //   console.log(`city: ${part.input.city}`); // string
          //   console.log(`result: ${part.result}`);
          //   break;
          // }

          case 'weather': {
            console.log('TOOL RESULT weather');
            console.log(`location: ${part.input.location}`); // string
            console.log(`temperature: ${part.output.temperature}`); // number
            break;
          }
        }

        break;
      }

      case 'error':
        console.error('Error:', part.error);
        break;
    }
  }
});
