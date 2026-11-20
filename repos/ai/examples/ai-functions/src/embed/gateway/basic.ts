import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await embed({
    model: 'openai/text-embedding-3-small',
    value: 'sunny day at the beach',
  });

  console.log('Embedding:', result.embedding);
  console.log('Usage:', result.usage);
  console.log('Warnings:', result.warnings);

  if (result.providerMetadata) {
    console.log('\nProvider Metadata:');
    console.log(JSON.stringify(result.providerMetadata, null, 2));
  }
});
