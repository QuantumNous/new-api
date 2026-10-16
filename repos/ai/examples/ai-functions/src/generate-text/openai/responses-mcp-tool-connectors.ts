import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

if (!process.env.GOOGLE_TEMP_OAUTH_KEY) {
  console.log('Access token not found!');
  console.log(
    'Access oauth token by following the steps mentioned here: https://platform.openai.com/docs/guides/tools-connectors-mcp#authorizing-a-connector',
  );
  process.exit(1);
}

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5-mini'),
    prompt: 'What is on my calendar for today?',
    tools: {
      mcp: openai.tools.mcp({
        serverLabel: 'google_calendar',
        connectorId: 'connector_googlecalendar',
        authorization: process.env.GOOGLE_TEMP_OAUTH_KEY,
        serverDescription: 'A connector to access the google calendar',
      }),
    },
  });

  console.log('\nTOOL CALLS:\n');
  console.dir(result.toolCalls, { depth: Infinity });
  console.log('\nTOOL RESULTS:\n');
  console.dir(result.toolResults, { depth: Infinity });
  console.log('\nTEXT RESULT:\n');
  console.log(result.text);
});
