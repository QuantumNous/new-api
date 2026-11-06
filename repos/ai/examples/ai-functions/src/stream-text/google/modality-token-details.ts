import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
          },
        ],
      },
    ],
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const usageMetadata = (await result.finalStep).providerMetadata?.google
    ?.usageMetadata as Record<string, unknown> | undefined;

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Modality token details:', {
    promptTokensDetails: usageMetadata?.promptTokensDetails,
    candidatesTokensDetails: usageMetadata?.candidatesTokensDetails,
  });
});
