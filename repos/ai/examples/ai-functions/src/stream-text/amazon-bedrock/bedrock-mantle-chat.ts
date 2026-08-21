import { createBedrockMantle } from '@ai-sdk/amazon-bedrock/mantle';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const bedrockMantle = createBedrockMantle({
    region: 'us-east-1',
  });

  const result = streamText({
    model: bedrockMantle.chat('openai.gpt-oss-20b'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log('Response headers:', (await result.response).headers);
});
