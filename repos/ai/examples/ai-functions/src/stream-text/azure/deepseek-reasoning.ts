import { createAzure } from '@ai-sdk/azure';
import { streamText } from 'ai';
import { run } from '../../lib/run';

const azure = createAzure({
  baseURL: process.env.AZURE_BASE_URL,
});

run(async () => {
  const result = streamText({
    model: azure.deepseek('deepseek-v4-pro'),
    prompt:
      'Can you please invent a new holiday around the latest Knicks game?',
    reasoning: 'high',
    include: {
      rawChunks: true,
    },
  });

  let isReasoningSectionStarted = false;
  let isTextSectionStarted = false;

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'reasoning-start':
        if (!isReasoningSectionStarted) {
          console.log('\n=== Reasoning ===');
          isReasoningSectionStarted = true;
        }
        process.stdout.write('\x1b[34m');
        break;

      case 'reasoning-delta':
        process.stdout.write(chunk.text);
        break;

      case 'reasoning-end':
        process.stdout.write('\x1b[0m\n');
        break;

      case 'text-start':
        if (!isTextSectionStarted) {
          console.log('\n=== Text ===');
          isTextSectionStarted = true;
        }
        process.stdout.write('\x1b[0m');
        break;

      case 'text-delta':
        process.stdout.write(chunk.text);
        break;

      case 'text-end':
        process.stdout.write('\x1b[0m\n');
        break;
    }
  }

  return result;
});
