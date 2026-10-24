import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5.3-codex'),
    prompt: 'What is the capital of France?',
    providerOptions: {
      openai: {
        instructions:
          'Before making any tool calls, send a short commentary message explaining what you are about to do.',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    tools: {
      web_search: openai.tools.webSearch(),
    },
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-start': {
        const phase = chunk.providerMetadata?.openai?.phase;
        console.log(`\nTEXT START [phase: ${phase ?? 'none'}]`);
        break;
      }
      case 'text-delta':
        process.stdout.write(chunk.text);
        break;
      case 'text-end': {
        const phase = chunk.providerMetadata?.openai?.phase;
        console.log(`\nTEXT END [phase: ${phase ?? 'none'}]`);
        break;
      }
    }
  }
});
