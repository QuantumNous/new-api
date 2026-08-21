import { generateText } from 'ai';
import type { OpenAILanguageModelChatOptions } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { run } from '../../lib/run';

run(async () => {
  const openai = createOpenAICompatible({
    baseURL: 'https://api.openai.com/v1',
    name: 'openai',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  const model = openai.chatModel('gpt-5-mini');

  const result = await generateText({
    model: model,
    prompt: 'Explain the theory of relativity in simple terms.',
    reasoning: 'low',
    providerOptions: {
      openai: {
        textVerbosity: 'low',
      } satisfies OpenAILanguageModelChatOptions,
    },
  });
  console.log(result.text);
  console.log(result.request.body);
});
