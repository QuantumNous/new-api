import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-3.1-pro-preview'),
    prompt: 'Cook me a lasagna.',
    tools: {
      cookRecipe: {
        description: 'Cook a recipe',
        inputSchema: z.object({
          recipe: z.object({
            name: z.string(),
            ingredients: z.array(
              z.object({
                name: z.string(),
                amount: z.string(),
              }),
            ),
            steps: z.array(z.string()),
          }),
        }),
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
