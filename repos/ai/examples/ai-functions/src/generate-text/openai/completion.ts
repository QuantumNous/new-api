import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-3.5-turbo-instruct'),
    maxOutputTokens: 1024,
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
});
