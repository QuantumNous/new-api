import { google } from '@ai-sdk/google';
import { isStepCount, streamText } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-3-flash-preview'),
    tools: {
      weather: weatherTool,
      google_search: google.tools.googleSearch({}),
    },
    prompt:
      'What is the weather in San Francisco and what are the latest news about the city?',
    stopWhen: isStepCount(5),
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        console.log(
          `\nTool call: ${part.toolName}`,
          JSON.stringify(part.input),
        );
        break;
      case 'tool-result':
        console.log(
          `Tool result: ${part.toolName}`,
          JSON.stringify(part.output),
        );
        break;
      case 'source':
        if (part.sourceType === 'url') {
          console.log(`Source: ${part.title} - ${part.url}`);
        }
        break;
      case 'error':
        console.error('Error:', part.error);
        break;
    }
  }
});
