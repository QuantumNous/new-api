import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What happened in tech news today?',
    tools: {
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: 3,
        userLocation: {
          type: 'approximate',
          city: 'New York',
          country: 'US',
          timezone: 'America/New_York',
        },
      }),
    },
  });

  console.dir(result.response.body, { depth: Infinity });
  console.dir(result.content, { depth: Infinity });
});
