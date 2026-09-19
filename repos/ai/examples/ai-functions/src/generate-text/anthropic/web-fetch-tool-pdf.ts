import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-0'),
    prompt:
      'What does this pdf say about AI?\n' +
      'https://raw.githubusercontent.com/vercel/ai/main/examples/ai-functions/data/ai.pdf',
    tools: {
      web_fetch: anthropic.tools.webFetch_20250910(),
    },
  });

  console.dir(result.response.body, { depth: Infinity });
  console.dir(result.content, { depth: Infinity });
});
