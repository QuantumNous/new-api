import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result = await generateText({
    model: amazonBedrock('anthropic.claude-3-5-sonnet-20241022-v2:0'),
    maxOutputTokens: 512,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. You may be asked about ${errorMessage}.`,
        providerOptions: {
          bedrock: { cachePoint: { type: 'default' } },
        },
      },
      {
        role: 'user',
        content: `Explain the error message`,
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
  console.log('Response headers:', result.response.headers);
});
