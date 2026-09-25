import { bedrockMantle } from '@ai-sdk/amazon-bedrock/mantle';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockMantle('openai.gpt-oss-20b'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Response headers:', result.response.headers);
});
