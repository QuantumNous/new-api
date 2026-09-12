import { togetherai } from '@ai-sdk/togetherai';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: togetherai.embeddingModel('BAAI/bge-base-en-v1.5'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
