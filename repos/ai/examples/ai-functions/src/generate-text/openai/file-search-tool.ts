import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  console.log(JSON.stringify(result.response.body, null, 2));
  console.dir(result.toolCalls, { depth: Infinity });
  console.dir(result.toolResults, { depth: Infinity });
  console.dir(result.sources, { depth: Infinity });
  console.log(result.text);
});
