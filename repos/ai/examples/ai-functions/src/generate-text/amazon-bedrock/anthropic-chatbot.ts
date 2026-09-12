import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    instructions: 'You are a helpful assistant.',
    messages: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hello! How can I help you today?' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
  });

  console.log('Response:', result.text);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
