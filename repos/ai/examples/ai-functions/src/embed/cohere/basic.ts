import { cohere } from '@ai-sdk/cohere';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: cohere.embedding('embed-multilingual-v3.0'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
