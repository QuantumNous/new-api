import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-4o-mini'),
    prompt: 'Invent a new holiday and describe its traditions.',
    maxOutputTokens: 1000,
    providerOptions: {
      openai: {
        parallelToolCalls: false,
        store: false,
        metadata: {
          key1: 'value1',
          key2: 'value2',
        },
        user: 'user_123',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);

  console.log('Request:', JSON.stringify(result.request, null, 2));
  console.log('Response:', JSON.stringify(result.response, null, 2));
});
