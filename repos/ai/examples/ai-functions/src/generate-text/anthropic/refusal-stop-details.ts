import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-fable-5'),
    prompt: 'Tell me about the history of the printing press.',
  });

  console.log('Text:');
  console.log(result.text);
  console.log();

  // A classifier block or model refusal surfaces as a `content-filter` finish
  // reason. Branch on the finish reason, not on the presence of stop details:
  // the API may return a refusal with no details at all.
  if (result.finishReason === 'content-filter') {
    const stopDetails =
      result.finalStep.providerMetadata?.anthropic?.stopDetails;
    console.log('Request was refused.');
    console.log('Stop details:', stopDetails ?? '(none provided)');
  }
});
