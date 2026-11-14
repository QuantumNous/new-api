import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { run } from '../../lib/run';

const stablePrefix =
  'A support ticket must include the account ID, incident time, observed behavior, expected behavior, and attempted mitigations. '.repeat(
    128,
  );
// A fresh key ensures the first request demonstrates a cache write. Applications
// should reuse a stable key for requests that share the same prefix.
const promptCacheKey = `ai-sdk:gpt-5.6:responses-explicit-cache:${randomUUID()}`;

async function generateWithCachedPrefix(question: string) {
  return generateText({
    model: openai.responses('gpt-5.6'),
    reasoning: 'none',
    maxOutputTokens: 80,
    allowSystemInMessages: true,
    messages: [
      {
        role: 'system',
        content: stablePrefix,
        providerOptions: {
          openai: {
            promptCacheBreakpoint: { mode: 'explicit' },
          },
        },
      },
      { role: 'user', content: question },
    ],
    providerOptions: {
      openai: {
        promptCacheKey,
        promptCacheOptions: { mode: 'explicit', ttl: '30m' },
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });
}

run(async () => {
  const firstResult = await generateWithCachedPrefix(
    'Summarize the required ticket fields.',
  );

  console.log('First response:', firstResult.text);
  console.log('First usage:', firstResult.usage);
  console.log();

  await setTimeout(1000);

  const secondResult = await generateWithCachedPrefix(
    'Which required field describes troubleshooting already performed?',
  );

  console.log('Second response:', secondResult.text);
  console.log('Second usage:', secondResult.usage);
  console.log();
  console.log(
    'Cache writes:',
    firstResult.usage.inputTokenDetails.cacheWriteTokens,
  );
  console.log(
    'Cache reads:',
    secondResult.usage.inputTokenDetails.cacheReadTokens,
  );
});
