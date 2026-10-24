import {
  togetherai,
  type TogetherAIRerankingModelOptions,
} from '@ai-sdk/togetherai';
import { rerank } from 'ai';
import { print } from '../lib/print';
import { run } from '../lib/run';
import { documents } from './documents';

run(async () => {
  const result = await rerank({
    model: togetherai.reranking('Salesforce/Llama-Rank-v1'),
    documents,
    query: 'Which pricing did we get from Oracle?',
    topN: 2,
    providerOptions: {
      togetherai: {
        rankFields: ['from', 'to', 'date', 'subject', 'text'],
      } satisfies TogetherAIRerankingModelOptions,
    },
  });

  print('Reranking:', result.ranking);
});
