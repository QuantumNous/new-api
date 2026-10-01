import { alibaba, type AlibabaEmbeddingModelOptions } from '@ai-sdk/alibaba';
import { embedMany } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embeddings, providerMetadata, usage, warnings } = await embedMany({
    model: alibaba.embedding('text-embedding-v4'),
    values: [
      'sunny day at the beach',
      'rainy afternoon in the city',
      'snowy night in the mountains',
      'quiet morning in the library',
      'busy market with fresh fruit',
      'calm lake beside pine trees',
      'crowded train station at dusk',
      'warm soup on a winter evening',
      'bright flowers in a spring garden',
      'long walk through an old town',
    ],
    providerOptions: {
      alibaba: {
        textType: 'document',
        dimension: 1024,
        outputType: 'dense&sparse',
      } satisfies AlibabaEmbeddingModelOptions,
    },
  });

  console.log(embeddings);
  console.log(providerMetadata?.alibaba);
  console.log(usage);
  console.log(warnings);
});
