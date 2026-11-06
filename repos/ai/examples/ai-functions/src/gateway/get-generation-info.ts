import { gateway, streamText } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = streamText({
    model: gateway('anthropic/claude-haiku-4.5'),
    prompt: 'What animals are relatives of the tenrec?',
  });

  result.consumeStream();
  console.log('Response:', await result.text);
  console.log('Token usage:', await result.usage);
  const providerMetadata = await result.providerMetadata;
  console.log('Provider metadata:', JSON.stringify(providerMetadata, null, 2));

  const generationId = (
    providerMetadata?.gateway as { generationId?: string } | undefined
  )?.generationId;

  if (!generationId) {
    console.log('No generation ID found in provider metadata.');
    return;
  }

  console.log(`\nGeneration ID: ${generationId}`);

  console.log('\nWaiting briefly for generation data to become available...');
  await new Promise(resolve => setTimeout(resolve, 30_000));

  console.log('\n--- Generation Details ---\n');
  const generation = await gateway.getGenerationInfo({ id: generationId });
  console.log(JSON.stringify(generation, null, 2));
});
