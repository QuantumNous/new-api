import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: 'what is the sum of the first 10 prime numbers?',
    reasoning: 'medium',
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  console.log('=== REASONING (thoughts) ===');
  if (result.reasoning) {
    console.log(result.reasoning);
  } else {
    console.log('(no reasoning returned)');
  }

  console.log('\n=== TEXT (final answer) ===');
  console.log(result.text);

  console.log('\n=== USAGE ===');
  console.log('Input tokens:', result.usage.inputTokens);
  console.log('Output tokens:', result.usage.outputTokens);
  console.log(
    'Reasoning tokens:',
    result.usage.outputTokenDetails.reasoningTokens || 0,
  );
  console.log('Total tokens:', result.usage.totalTokens);
});
