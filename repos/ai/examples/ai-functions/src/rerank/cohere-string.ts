import { cohere, type CohereRerankingModelOptions } from '@ai-sdk/cohere';
import { rerank } from 'ai';
import { run } from '../lib/run';
import { print } from '../lib/print';

run(async () => {
  const result = await rerank({
    model: cohere.reranking('rerank-v3.5'),
    documents: ['sunny day at the beach', 'rainy day in the city'],
    query: 'talk about rain',
    topN: 2,
    providerOptions: {
      cohere: {
        priority: 1,
      } satisfies CohereRerankingModelOptions,
    },
  });

  print('Reranking:', result.ranking);
});
