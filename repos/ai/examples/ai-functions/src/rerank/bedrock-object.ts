import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { rerank } from 'ai';
import { run } from '../lib/run';
import { print } from '../lib/print';
import { documents } from './documents';

run(async () => {
  const result = await rerank({
    model: amazonBedrock.reranking('cohere.rerank-v3-5:0'),
    documents,
    query: 'Which pricing did we get from Oracle?',
    topN: 2,
  });

  print('Reranking:', result.ranking);
});
