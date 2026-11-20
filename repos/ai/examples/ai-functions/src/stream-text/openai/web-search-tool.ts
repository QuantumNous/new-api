import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    prompt:
      'What happened in tech news today? Open a few pages and search for a key word pattern vercel on those pages.',
    tools: {
      web_search: openai.tools.webSearch({
        searchContextSize: 'medium',
      }),
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
