import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

const anthropic = createAnthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
});

run(async () => {
  const result = await generateText({
    model: anthropic('haiku'),
    prompt: 'Invent a new holiday and describe its traditions.',
    headers: {
      accept: 'application/json',
    },
  });

  print('Content:', result.content);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
});
