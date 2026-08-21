import { anthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropicAws('claude-sonnet-4-6'),
    tools: {
      web_search: anthropicAws.tools.webSearch_20250305(),
    },
    prompt: 'What were the major AI announcements last week?',
  });

  print('Content:', result.content);
  print('Sources:', result.sources);
  print('Usage:', result.usage);
});
