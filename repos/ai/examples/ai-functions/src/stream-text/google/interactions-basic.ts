import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google.interactions('gemini-2.5-flash'),
    prompt: 'Hello, how are you?',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const googleMetadata = (await result.finalStep).providerMetadata?.google;

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
