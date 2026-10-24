import { cohere, type CohereEmbeddingModelOptions } from '@ai-sdk/cohere';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // outputDimension: 256, 512, 1024, or 1536 (default)
  const { embedding, usage, warnings } = await embed({
    model: cohere.embedding('embed-v4.0'),
    value: 'sunny day at the beach',
    providerOptions: {
      cohere: {
        outputDimension: 256,
      } satisfies CohereEmbeddingModelOptions,
    },
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
