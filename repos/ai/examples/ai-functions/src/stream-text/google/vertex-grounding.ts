import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-2.5-flash'),
    tools: {
      google_search: googleVertex.tools.googleSearch({}),
    },
    prompt:
      'List the top 5 San Francisco news from the past week.' +
      'You must include the date of each article.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log((await result.finalStep).providerMetadata?.google);
  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
