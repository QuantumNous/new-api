import { xai, type XaiLanguageModelResponsesOptions } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai.responses('grok-3-mini-latest'),
    providerOptions: {
      xai: {
        reasoningEffort: 'low',
        reasoningSummary: 'detailed',
      } satisfies XaiLanguageModelResponsesOptions,
    },
    prompt: 'What is 12 * 37?',
  });

  console.log('Response:', result.text);
  console.log();
  console.log(
    'Reasoning tokens:',
    result.usage.outputTokenDetails?.reasoningTokens,
  );
  console.log('Text tokens:', result.usage.outputTokenDetails?.textTokens);
});
