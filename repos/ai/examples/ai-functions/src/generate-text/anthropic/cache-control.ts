import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
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
                cacheControl: { type: 'ephemeral', ttl: '1h' },
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
  });

  console.log(result.text);
  console.log();

  console.log(
    'Cache read tokens:',
    result.usage.inputTokenDetails.cacheReadTokens,
  );
  console.log(
    'Cache write tokens:',
    result.usage.inputTokenDetails.cacheWriteTokens,
  );
});
