import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: amazonBedrock.embedding('amazon.nova-2-multimodal-embeddings-v1:0'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
