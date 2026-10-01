import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-3.1-pro-preview'),
    prompt: 'What is the weather in Boston and San Francisco?',
    tools: {
      getWeather: {
        description: 'Get the current weather in a given location',
        inputSchema: z.object({
          location: z.string().describe('City name'),
        }),
      },
    },
    providerOptions: {
      vertex: {
        streamFunctionCallArguments: true,
      },
    },
    include: {
      rawChunks: true,
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'tool-input-start':
        console.log(`\n[tool-input-start] ${part.toolName} (${part.id})`);
        break;
      case 'tool-input-delta':
        process.stdout.write(part.delta);
        break;
      case 'tool-input-end':
        console.log(`\n[tool-input-end] (${part.id})`);
        break;
      case 'tool-call':
        console.log(`\n[tool-call] ${part.toolName}:`, part.input);
        break;
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'finish':
        console.log('\nFinish reason:', part.finishReason);
        console.log('Usage:', part.totalUsage);
        break;
      case 'error':
        console.error('Error:', part.error);
        break;
    }
  }

  await saveRawChunks({
    result,
    filename: 'google-vertex-stream-function-call-args-default.1',
  });
});
