import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    prompt: 'Count from 1 to 10, one number per line.',
    stopSequences: ['5'],
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log(
    'Stop sequence:',
    result.finalStep.providerMetadata?.anthropic?.stopSequence,
  );
  console.log('Usage:', result.usage);
});
