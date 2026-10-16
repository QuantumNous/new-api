import { voyage } from '@ai-sdk/voyage';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage } = await embed({
    model: voyage.embedding('voyage-3.5'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
});
