import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

const bedrockAnthropic = createBedrockAnthropic({
  headers: {
    'anthropic-beta': 'context-1m-2025-08-07',
  },
});

// Build a large text block intended to exceed the standard context window
const APPROX_TOKENS = 110_000;
const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = APPROX_TOKENS * CHARS_PER_TOKEN;

function makeBaseChunk(): string {
  let s = '';
  for (let j = 0; j < 500; j++) {
    s += `IDX:${j.toString(36)} | alpha:${'abcdefghijklmnopqrstuvwxyz'.slice(0, (j % 26) + 1)} | nums:${'0123456789'.repeat(3)} | sym:${'-=_+'.repeat(5)}\n`;
  }
  return s;
}

const baseChunk = makeBaseChunk();
const repeats = Math.ceil(TARGET_CHARS / baseChunk.length);
const largeContextText = baseChunk
  .repeat(repeats)
  .slice(0, TARGET_CHARS + 50_000);

run(async () => {
  const estimatedTokens = Math.ceil(largeContextText.length / CHARS_PER_TOKEN);
  console.log('Prepared large context chars:', largeContextText.length);
  console.log('Estimated tokens (chars/4):', estimatedTokens);

  const startstamp = performance.now();

  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-20250514-v1:0'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `The following is a large context payload.\n\n${largeContextText}`,
          },
          {
            type: 'text',
            text: 'Summarize the structure of the data above in one sentence.',
          },
        ],
      },
    ],
    providerOptions: {
      // alternatively this feature can be enabled with:
      // anthropic: {
      //   anthropicBeta: ['context-1m-2025-08-07'],
      // },
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const endstamp = performance.now();
  console.log();
  console.log(
    'Time taken:',
    ((endstamp - startstamp) / 1000).toFixed(2),
    'seconds',
  );
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
