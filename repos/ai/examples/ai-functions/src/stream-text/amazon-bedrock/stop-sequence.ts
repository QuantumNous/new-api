import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: amazonBedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
    prompt: 'Write a short story and end it with the word END.',
    stopSequences: ['END'],
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log(
    'Stop sequence:',
    (await result.finalStep).providerMetadata?.bedrock?.stopSequence,
  );
});
