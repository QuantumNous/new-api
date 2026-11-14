import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: google.embeddingModel('gemini-embedding-2-preview'),
    value: 'sunny day at the beach',
  });

  console.log('embedding length:', embedding.length);
  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
