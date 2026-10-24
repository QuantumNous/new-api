import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertex('gemini-2.5-flash'),
    prompt:
      "Describe the most unusual or striking architectural feature you've ever seen in a building or structure.",
    reasoning: 'medium',
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  process.stdout.write('\x1b[34m' + result.reasoning + '\x1b[0m');
  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);

  console.log();
  console.log('Warnings:', result.warnings);
});
