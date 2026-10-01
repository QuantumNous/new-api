import { mistral } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embeddings, usage, warnings } = await embedMany({
    model: mistral.embedding('mistral-embed'),
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
