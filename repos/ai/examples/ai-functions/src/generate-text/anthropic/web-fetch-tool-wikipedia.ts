import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-0'),
    prompt:
      'What is this page about? https://en.wikipedia.org/wiki/Maglemosian_culture',
    tools: {
      web_fetch: anthropic.tools.webFetch_20250910(),
    },
  });

  console.dir(result.response.body, { depth: Infinity });
  console.dir(result.content, { depth: Infinity });
});
