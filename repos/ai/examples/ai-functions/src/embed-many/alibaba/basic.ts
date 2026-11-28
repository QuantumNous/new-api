import { alibaba, type AlibabaEmbeddingModelOptions } from '@ai-sdk/alibaba';
import { embedMany } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embeddings, usage, warnings } = await embedMany({
    model: alibaba.embedding('text-embedding-v4'),
    values: [
      'sunny day at the beach',
      'rainy afternoon in the city',
      'snowy night in the mountains',
    ],
    providerOptions: {
      alibaba: {
        textType: 'document',
        dimension: 1024,
        outputType: 'dense',
      } satisfies AlibabaEmbeddingModelOptions,
    },
  });

  console.log(embeddings);
  console.log(usage);
  console.log(warnings);
});
