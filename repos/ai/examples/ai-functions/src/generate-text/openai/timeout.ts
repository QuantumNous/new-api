import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage } = await generateText({
    model: openai('gpt-3.5-turbo'),
    prompt: 'Invent a new holiday and describe its traditions.',
    timeout: 1000, // 1 second timeout
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
});
