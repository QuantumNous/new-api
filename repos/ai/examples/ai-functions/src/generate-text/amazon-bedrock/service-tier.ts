import {
  amazonBedrock,
  type AmazonBedrockLanguageModelChatOptions,
} from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('openai.gpt-oss-120b-1:0'),
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      bedrock: {
        serviceTier: 'flex',
      } satisfies AmazonBedrockLanguageModelChatOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
