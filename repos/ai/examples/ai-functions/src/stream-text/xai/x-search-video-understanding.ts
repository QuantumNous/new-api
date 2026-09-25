import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { stream } = streamText({
    model: xai.responses('grok-4-fast-non-reasoning'),
    tools: {
      x_search: xai.tools.xSearch({
        allowedXHandles: ['xai', 'elonmusk'],
        enableImageUnderstanding: true,
        enableVideoUnderstanding: true,
      }),
    },
    prompt:
      'what are the latest videos and images from xai showing their products or announcements',
  });

  console.log('searching x for videos and images from xai...\n');

  for await (const part of stream) {
    switch (part.type) {
      case 'tool-call':
        if (part.providerExecuted) {
          console.log(`[tool: ${part.toolName}]`);
        }
        break;

      case 'text-delta':
        process.stdout.write(part.text);
        break;

      case 'source':
        if (part.sourceType === 'url') {
          console.log(`\n[source: ${part.url}]`);
        }
        break;
    }
  }

  console.log('\n');
});
