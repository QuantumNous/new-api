import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { embedMany } from 'ai';
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
  const { embeddings, usage, warnings } = await embedMany({
    model,
    values: [
      'sunny day at the beach',
      'rainy afternoon in the city',
      'snowy night in the mountains',
    ],
  });

  console.log(embeddings);
  console.log(usage);
  console.log(warnings);
});
