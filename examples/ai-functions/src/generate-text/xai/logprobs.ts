import { xai, type XaiLanguageModelResponsesOptions } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai.responses('grok-4-latest'),
    prompt: 'write one short sentence about san francisco',
    providerOptions: {
      xai: {
        logprobs: true,
        topLogprobs: 3,
      } satisfies XaiLanguageModelResponsesOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('warnings:', result.warnings);
  console.log('usage:', result.usage);
});
