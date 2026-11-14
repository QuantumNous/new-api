import { google, type GoogleProviderMetadata } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  const { text, sources } = result;
  const providerMetadata = result.finalStep.providerMetadata;
  const metadata = providerMetadata?.google as
    | GoogleProviderMetadata
    | undefined;
  const groundingMetadata = metadata?.groundingMetadata;

  console.log(text);
  console.log();
  console.log('SOURCES');
  console.log(sources);
  console.log();
  console.log('PROVIDER METADATA');
  console.log(groundingMetadata);
});
