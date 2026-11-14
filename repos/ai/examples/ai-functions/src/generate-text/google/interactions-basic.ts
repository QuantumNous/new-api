import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    prompt: 'Hello, how are you?',
  });

  const googleMetadata = result.finalStep.providerMetadata?.google;

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
