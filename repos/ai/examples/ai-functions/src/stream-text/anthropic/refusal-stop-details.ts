import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-fable-5'),
    prompt: 'Tell me about the history of the printing press.',
  });

  console.log('Text:');
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
  console.log();
  console.log();

  // A classifier block or model refusal surfaces as a `content-filter` finish
  // reason. Branch on the finish reason, not on the presence of stop details:
  // the API may return a refusal with no details at all.
  const finalStep = await result.finalStep;
  if (finalStep.finishReason === 'content-filter') {
    const stopDetails = finalStep.providerMetadata?.anthropic?.stopDetails;
    console.log('Request was refused.');
    console.log('Stop details:', stopDetails ?? '(none provided)');
  }
});
