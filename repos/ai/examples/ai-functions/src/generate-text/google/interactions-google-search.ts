import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt:
      "What's a notable AI development from this past week? " +
      'Include the date for each item you mention.',
  });

  const googleMetadata = result.finalStep.providerMetadata?.google;

  console.log(result.text);
  console.log();
  console.log('SOURCES');
  console.log(result.sources);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
