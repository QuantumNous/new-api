import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Based on this context: https://ai-sdk.dev/providers/ai-sdk-providers/google, tell me how to use Gemini with AI SDK.
            Also, provide the latest news about AI SDK V5.`,
          },
        ],
      },
    ],
    tools: {
      url_context: google.tools.urlContext({}),
      google_search: google.tools.googleSearch({}),
    },
  });

  console.log(result.text);
  console.log();
  console.log('SOURCES');
  console.log(result.sources);
  console.log();
  console.log('PROVIDER METADATA');
  console.log(result.finalStep.providerMetadata?.google);
});
