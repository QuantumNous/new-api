import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    prompt: 'Count from 1 to 10, one number per line.',
    stopSequences: ['5'],
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'finish-step':
        console.log('\n\n--- Finish Step ---');
        console.log('Finish reason:', part.finishReason);
        console.log('Raw finish reason:', part.rawFinishReason);
        console.log(
          'Stop sequence:',
          part.providerMetadata?.anthropic?.stopSequence,
        );
        break;
    }
  }
});
