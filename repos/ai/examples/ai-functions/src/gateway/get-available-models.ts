import { gateway } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const { models } = await gateway.getAvailableModels();
  console.log(`Found ${models.length} available models:\n`);
  for (const model of models) {
    console.log(`- ${model.id} (${model.modelType ?? 'unknown'})`);
  }
});
