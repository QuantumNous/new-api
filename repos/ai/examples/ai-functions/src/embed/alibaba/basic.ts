import { alibaba, type AlibabaEmbeddingModelOptions } from '@ai-sdk/alibaba';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, providerMetadata, usage, warnings } = await embed({
    model: alibaba.embedding('text-embedding-v4'),
    value: 'sunny day at the beach',
    providerOptions: {
      alibaba: {
        textType: 'document',
        dimension: 1024,
        outputType: 'dense',
      } satisfies AlibabaEmbeddingModelOptions,
    },
  });

  console.log(embedding);
  console.log(providerMetadata?.alibaba?.sparseEmbeddings);
  console.log(usage);
  console.log(warnings);
});
