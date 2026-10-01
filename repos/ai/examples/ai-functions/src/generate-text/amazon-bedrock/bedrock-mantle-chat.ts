import { createBedrockMantle } from '@ai-sdk/amazon-bedrock/mantle';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const bedrockMantle = createBedrockMantle({
    region: 'us-east-1',
  });

  const result = await generateText({
    model: bedrockMantle.chat('openai.gpt-oss-120b'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Response headers:', result.response.headers);
});
