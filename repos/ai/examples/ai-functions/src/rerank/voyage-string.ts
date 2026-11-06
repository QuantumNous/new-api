import { voyage } from '@ai-sdk/voyage';
import { rerank } from 'ai';
import { run } from '../lib/run';
import { print } from '../lib/print';

run(async () => {
  const result = await rerank({
    model: voyage.reranking('rerank-2.5'),
    documents: ['sunny day at the beach', 'rainy day in the city'],
    query: 'talk about rain',
    topN: 2,
  });

  print('Reranking:', result.ranking);
});
