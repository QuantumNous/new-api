import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { streamText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result = streamText({
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are a JavaScript expert.',
          },
          {
            type: 'text',
            text: `Error message: ${errorMessage}`,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              } satisfies AnthropicLanguageModelOptions,
            },
          },
          {
            type: 'text',
            text: 'Explain the error message.',
          },
        ],
      },
    ],
    onEnd({ finalStep }) {
      console.log();
      console.log('=== onEnd ===');
      console.log(finalStep.providerMetadata?.anthropic);
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const usage = await result.usage;
  console.log();
  console.log('=== usage ===');
  console.log('Cache read tokens:', usage.inputTokenDetails.cacheReadTokens);
  console.log('Cache write tokens:', usage.inputTokenDetails.cacheWriteTokens);
});
