import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Invent a new holiday and describe its traditions.',
    onEnd({ usage, finishReason, text }) {
      console.log();
      console.log('onEnd');
      console.log('Token usage:', usage);
      console.log('Finish reason:', finishReason);
      console.log('Text:', text);
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
