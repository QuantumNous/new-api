import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const deepseek = createOpenAICompatible({
    baseURL: 'https://api.deepseek.com/v1',
    name: 'deepseek',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  });
  const model = deepseek.chatModel('deepseek-chat');
  const result = streamText({
    model,
    prompt:
      'List the top 5 San Francisco news from the past week.' +
      'You must include the date of each article.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
