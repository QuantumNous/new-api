import {
  deepSeek,
  type DeepSeekLanguageModelChatOptions,
} from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: deepSeek('deepseek-chat'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    providerOptions: {
      deepseek: {
        thinking: { type: 'enabled' },
        reasoningEffort: 'high',
      } satisfies DeepSeekLanguageModelChatOptions,
    },
  });

  print('Reasoning:', result.reasoningText?.slice(0, 200));
  print('Response:', result.text);
  print('Request:', result.request.body);
});
