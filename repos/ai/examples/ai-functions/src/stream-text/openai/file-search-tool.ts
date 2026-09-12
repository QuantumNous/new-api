import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    prompt: 'What is an embedding model according to this document?',
    tools: {
      file_search: openai.tools.fileSearch({
        vectorStoreIds: ['vs_68caad8bd5d88191ab766cf043d89a18'],
      }),
    },
    providerOptions: {
      openai: {
        include: ['file_search_call.results'],
      } satisfies OpenAILanguageModelResponsesOptions,
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
        process.stdout.write(
          `\n\n\x1b[36mSource: ${chunk.title} (${JSON.stringify(chunk)})\x1b[0m\n\n`,
        );
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
