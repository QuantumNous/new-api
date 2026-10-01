import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  console.log('Testing OpenAI Flex Processing...\n');

  const result = streamText({
    model: openai('o3-mini'),
    prompt: 'Explain quantum computing in simple terms.',
    providerOptions: {
      openai: {
        serviceTier: 'flex', // 50% cheaper processing with increased latency
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log('Response (using flex processing for 50% cost savings):');
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log('\n\nUsage:');
  const usage = await result.usage;
  console.log(`Input tokens: ${usage.inputTokens}`);
  console.log(`Output tokens: ${usage.outputTokens}`);
  console.log(`Total tokens: ${usage.totalTokens}`);
});
