import { googleVertex } from '@ai-sdk/google-vertex';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: googleVertex.embeddingModel('gemini-embedding-001'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
