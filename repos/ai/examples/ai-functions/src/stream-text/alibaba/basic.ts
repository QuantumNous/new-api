import { alibaba } from '@ai-sdk/alibaba';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: alibaba('qwen-plus'),
    prompt: 'Write a one sentence description about AI.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
