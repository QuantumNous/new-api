import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { streamText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result = streamText({
    model: amazonBedrock('anthropic.claude-3-5-sonnet-20241022-v2:0'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `I was dreaming last night and I dreamt of an error message: ${errorMessage}`,
          },
        ],
        providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Explain the error message.',
          },
        ],
      },
    ],
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log(
    'Cache token usage:',
    (await result.finalStep).providerMetadata?.bedrock?.usage,
  );
  console.log('Finish reason:', await result.finishReason);
  console.log('Response headers:', (await result.response).headers);
});
