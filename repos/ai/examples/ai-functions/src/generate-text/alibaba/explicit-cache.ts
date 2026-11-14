import { alibaba, type AlibabaUsage } from '@ai-sdk/alibaba';
import { generateText } from 'ai';
import { run } from '../../lib/run';

/**
 * Demonstrates Alibaba's explicit cache feature using cache_control.
 * Requires minimum 1,024 tokens for explicit caching.
 */

run(async () => {
  // Long system prompt (1024+ tokens required for explicit cache)
  const longSystemPrompt = 'You are an expert AI assistant. '.repeat(200);

  console.log('First request...\n');

  const firstResult = await generateText({
    model: alibaba('qwen-plus'),
    messages: [
      {
        role: 'system',
        content: longSystemPrompt,
        providerOptions: {
          alibaba: {
            cache_control: { type: 'ephemeral' },
          },
        },
      },
      {
        role: 'user',
        content: 'What is artificial intelligence?',
      },
    ],
  });

  console.log('Text:', firstResult.text.substring(0, 50) + '...');
  console.log('Usage:', firstResult.usage);
  console.log();

  const secondResult = await generateText({
    model: alibaba('qwen-plus'),
    messages: [
      {
        role: 'system',
        content: longSystemPrompt, // Same content
        providerOptions: {
          alibaba: {
            cache_control: { type: 'ephemeral' },
          },
        },
      },
      {
        role: 'user',
        content: 'Explain machine learning briefly.',
      },
    ],
  });

  console.log('Second request (hits cache within 5 minutes)...\n');
  console.log('Text:', secondResult.text.substring(0, 50) + '...');
  console.log('Usage:', secondResult.usage);
  console.log();

  console.log('='.repeat(50));

  const firstRaw = firstResult.usage.raw as AlibabaUsage;
  const secondRaw = secondResult.usage.raw as AlibabaUsage;

  const firstCreated =
    firstRaw.prompt_tokens_details?.cache_creation_input_tokens || 0;
  const firstHit = firstRaw.prompt_tokens_details?.cached_tokens || 0;
  const secondHit = secondRaw.prompt_tokens_details?.cached_tokens || 0;

  if (firstCreated > 0) {
    console.log(
      `SUCCESS: First request created cache (${firstCreated} tokens)`,
    );
  } else if (firstHit > 0) {
    console.log(
      `SUCCESS: First request hit existing cache (${firstHit} tokens)`,
    );
    console.log('(Cache from previous run still valid - within 5 minute TTL)');
  } else {
    console.log('FAILED: First request - no caching occurred');
  }

  if (secondHit > 0) {
    console.log(`SUCCESS: Second request hit cache (${secondHit} tokens)`);
  } else {
    console.log('FAILED: Second request - no cache hit');
  }

  if ((firstCreated > 0 || firstHit > 0) && secondHit > 0) {
    console.log('\nExplicit caching is working correctly!');
  } else {
    console.log(
      '\nExplicit caching failed - check cache_control configuration',
    );
  }
});
