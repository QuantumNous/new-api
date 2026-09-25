import { openai } from '@ai-sdk/openai';
import { streamText, wrapLanguageModel } from 'ai';
import { yourLogMiddleware } from './your-log-middleware';
import { run } from '../lib/run';

run(async () => {
  const result = streamText({
    model: wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: yourLogMiddleware,
    }),
    prompt: 'What cities are in the United States?',
  });

  for await (const textPart of result.textStream) {
    // consume the stream
  }
});
