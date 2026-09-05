import { embed } from 'ai';
import { registry } from './setup-registry';
import { run } from '../lib/run';

run(async () => {
  const { embedding } = await embed({
    model: registry.embeddingModel('openai:text-embedding-3-small'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
});
