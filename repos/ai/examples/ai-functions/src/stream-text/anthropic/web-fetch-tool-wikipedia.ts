import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-0'),
    prompt:
      'What is this page about? https://en.wikipedia.org/wiki/Maglemosian_culture',
    tools: {
      web_fetch: anthropic.tools.webFetch_20250910(),
    },
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\x1b[32m\x1b[1mTool call:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\x1b[32m\x1b[1mTool result:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-error': {
        console.log(
          `\x1b[32m\x1b[1mTool error:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'source': {
        if (chunk.sourceType === 'url') {
          process.stdout.write(
            `\n\n\x1b[36mSource: ${chunk.title} (${chunk.url})\x1b[0m\n\n`,
          );
        }
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
