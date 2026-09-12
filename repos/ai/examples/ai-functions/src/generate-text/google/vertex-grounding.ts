import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertex('gemini-2.5-flash'),
    tools: {
      google_search: googleVertex.tools.googleSearch({}),
    },
    prompt:
      'List the top 5 San Francisco news from the past week.' +
      'You must include the date of each article.',
  });

  console.log(result.text);
  console.log(result.finalStep.providerMetadata?.google);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
