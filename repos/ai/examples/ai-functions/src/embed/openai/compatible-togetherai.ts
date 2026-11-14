import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const togetherai = createOpenAICompatible({
    baseURL: 'https://api.together.xyz/v1',
    name: 'togetherai',
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
    },
  });
  const model = togetherai.embeddingModel('BAAI/bge-large-en-v1.5');
  const { embedding, usage, warnings } = await embed({
    model,
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
