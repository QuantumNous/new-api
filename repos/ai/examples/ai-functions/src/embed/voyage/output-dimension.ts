import { voyage } from '@ai-sdk/voyage';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage } = await embed({
    model: voyage.embedding('voyage-4-large'),
    value: 'sunny day at the beach',
    providerOptions: {
      voyage: {
        inputType: 'document',
        outputDimension: 512,
      },
    },
  });

  console.log(embedding);
  console.log(usage);
});
