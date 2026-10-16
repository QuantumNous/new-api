import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-3-5-sonnet-latest'),
    prompt: 'What are the latest developments in AI research and technology?',
    tools: {
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: 5,
        userLocation: {
          type: 'approximate',
          city: 'San Francisco',
          region: 'California',
          country: 'US',
          timezone: 'America/Los_Angeles',
        },
      }),
    },
  });

  console.log(JSON.stringify(result.content, null, 2));
});
