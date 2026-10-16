import { openai } from '@ai-sdk/openai';
import { generateText, wrapLanguageModel } from 'ai';
import { yourCacheMiddleware } from './your-cache-middleware';
import { run } from '../lib/run';

run(async () => {
  const modelWithCaching = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: yourCacheMiddleware,
  });

  const start1 = Date.now();
  const result1 = await generateText({
    model: modelWithCaching,
    prompt: 'What cities are in the United States?',
  });
  const end1 = Date.now();

  const start2 = Date.now();
  const result2 = await generateText({
    model: modelWithCaching,
    prompt: 'What cities are in the United States?',
  });
  const end2 = Date.now();

  console.log(`Time taken for result1: ${end1 - start1}ms`);
  console.log(`Time taken for result2: ${end2 - start2}ms`);

  console.log(result1.text === result2.text);
});
