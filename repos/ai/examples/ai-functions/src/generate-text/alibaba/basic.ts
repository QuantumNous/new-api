import { alibaba } from '@ai-sdk/alibaba';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: alibaba('qwen-plus'),
    prompt: 'Write a one sentence description about Seoul.',
  });

  console.log('Text:', result.text);
  console.log('\nUsage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
