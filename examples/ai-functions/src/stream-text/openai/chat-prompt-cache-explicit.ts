import { openai, type OpenAILanguageModelChatOptions } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { run } from '../../lib/run';

const stablePrefix =
  'A support ticket must include the account ID, incident time, observed behavior, expected behavior, and attempted mitigations. '.repeat(
    128,
  );
// A fresh key ensures the first request demonstrates a cache write. Applications
// should reuse a stable key for requests that share the same prefix.
const promptCacheKey = `ai-sdk:gpt-5.6:chat-explicit-cache:${randomUUID()}`;

async function streamWithCachedPrefix(label: string, question: string) {
  const result = streamText({
    model: openai.chat('gpt-5.6'),
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
      } satisfies OpenAILanguageModelChatOptions,
    },
  });

  process.stdout.write(`${label} response: `);
  for await (const textDelta of result.textStream) {
    process.stdout.write(textDelta);
  }
  console.log();

  const usage = await result.usage;
  console.log(`${label} usage:`, usage);
  console.log();

  return usage;
}

run(async () => {
  const firstUsage = await streamWithCachedPrefix(
    'First',
    'Summarize the required ticket fields.',
  );

  await setTimeout(1000);

  const secondUsage = await streamWithCachedPrefix(
    'Second',
    'Which required field describes troubleshooting already performed?',
  );

  console.log('Cache writes:', firstUsage.inputTokenDetails.cacheWriteTokens);
  console.log('Cache reads:', secondUsage.inputTokenDetails.cacheReadTokens);
});
