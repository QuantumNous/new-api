import {
  amazonBedrock,
  type AmazonBedrockLanguageModelChatOptions,
} from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('openai.gpt-oss-120b-1:0'),
    prompt: 'What is 2 + 2 equal to?',
    providerOptions: {
      bedrock: {
        reasoningConfig: { type: 'enabled', maxReasoningEffort: 'medium' },
      } satisfies AmazonBedrockLanguageModelChatOptions,
    },
  });

  console.log(result.reasoningText);
  console.log(result.text);
});
