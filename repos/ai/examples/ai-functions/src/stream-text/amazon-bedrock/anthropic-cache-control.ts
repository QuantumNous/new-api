import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that specializes in TypeScript and JavaScript development. You provide clear, concise explanations with code examples when appropriate.',
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          } satisfies AnthropicLanguageModelOptions,
        },
      },
      {
        role: 'user',
        content:
          'What is the difference between interface and type in TypeScript?',
      },
    ],
    maxOutputTokens: 500,
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
