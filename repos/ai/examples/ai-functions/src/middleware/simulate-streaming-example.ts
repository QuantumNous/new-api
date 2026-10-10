import { openai } from '@ai-sdk/openai';
import { simulateStreamingMiddleware, streamText, wrapLanguageModel } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = streamText({
    model: wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: simulateStreamingMiddleware(),
    }),
    prompt: 'What cities are in the United States?',
  });

  // will return everything at once after a while
  for await (const chunk of result.textStream) {
    console.log(chunk);
  }
});
