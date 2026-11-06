import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai.responses('grok-4-fast-non-reasoning'),
    prompt: 'What is the capital of France?',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log();
  console.log(
    'Provider metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
});
