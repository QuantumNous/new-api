import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const togetherai = createOpenAICompatible({
    baseURL: 'https://api.together.xyz/v1',
    name: 'togetherai',
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
    },
  });
  const model = togetherai.chatModel('meta-llama/Llama-3-70b-chat-hf');
  const result = await generateText({
    model,
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
