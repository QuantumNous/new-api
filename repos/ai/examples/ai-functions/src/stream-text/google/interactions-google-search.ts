import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google.interactions('gemini-2.5-flash'),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt:
      "What's a notable AI development from this past week? " +
      'Include the date for each item you mention.',
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }

    if (part.type === 'source' && part.sourceType === 'url') {
      console.log('\x1b[36m%s\x1b[0m', '\nSource');
      console.log('ID:', part.id);
      console.log('Title:', part.title);
      console.log('URL:', part.url);
    }
  }

  const googleMetadata = (await result.finalStep).providerMetadata?.google;

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
