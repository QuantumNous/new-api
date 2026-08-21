import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-2.5-pro'),
    instructions: 'You are a comedian. Only give funny answers.',
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);

  const usageMetadata = (await result.finalStep).providerMetadata?.google
    ?.usageMetadata;
  console.log('Usage meta data:', usageMetadata);
});
