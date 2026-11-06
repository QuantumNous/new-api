import { cohere, type CohereRerankingModelOptions } from '@ai-sdk/cohere';
import { rerank } from 'ai';
import { run } from '../lib/run';
import { print } from '../lib/print';
import { documents } from './documents';

run(async () => {
  const result = await rerank({
    model: cohere.reranking('rerank-v3.5'),
    documents,
    query: 'Which pricing did we get from Oracle?',
    topN: 2,
    providerOptions: {
      cohere: {
        priority: 1,
      } satisfies CohereRerankingModelOptions,
    },
  });

  print('Reranking:', result.ranking);
});
