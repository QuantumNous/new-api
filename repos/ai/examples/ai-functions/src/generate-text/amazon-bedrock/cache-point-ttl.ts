import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    maxOutputTokens: 512,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. You may be asked about ${errorMessage}.`,
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '1h' } },
        },
      },
      {
        role: 'user',
        content: 'Explain the error message',
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log(
    'Cache token usage:',
    result.finalStep.providerMetadata?.bedrock?.usage,
  );
  console.log('Finish reason:', result.finishReason);
});
