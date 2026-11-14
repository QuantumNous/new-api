import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { stream } = streamText({
    model: xai.responses('grok-4-fast-non-reasoning'),
    tools: {
      web_search: xai.tools.webSearch({
        allowedDomains: ['x.ai'],
        enableImageUnderstanding: true,
      }),
    },
    prompt:
      'search x.ai website and describe any images you find on the homepage',
  });

  console.log('searching x.ai with image understanding...\n');

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
