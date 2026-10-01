import { google, type GoogleProviderMetadata } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-2.5-flash'),
    tools: {
      google_search: google.tools.googleSearch({
        searchTypes: { webSearch: {} },
        timeRangeFilter: {
          startTime: '2026-02-18T00:00:00Z',
          endTime: '2026-02-25T00:00:00Z',
        },
      }),
    },
    prompt:
      'List the top 5 San Francisco news from the past week.' +
      'You must include the date of each article.',
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }

    if (part.type === 'source' && part.sourceType === 'url') {
      console.log('\x1b[36m%s\x1b[0m', 'Source');
      console.log('ID:', part.id);
      console.log('Title:', part.title);
      console.log('URL:', part.url);
      console.log();
    }
  }

  const metadata = (await result.finalStep).providerMetadata?.google as
    | GoogleProviderMetadata
    | undefined;
  const groundingMetadata = metadata?.groundingMetadata;

  console.log();
  console.log('GROUNDING METADATA');
  console.log(groundingMetadata);
  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
