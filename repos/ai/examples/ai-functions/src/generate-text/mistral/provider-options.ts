import { mistral, type MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: mistral('open-mistral-7b'),
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      mistral: {
        safePrompt: true,
        documentImageLimit: 5,
        documentPageLimit: 10,
        // @ts-expect-error
        invalidOption: 0,
      } satisfies MistralLanguageModelChatOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
