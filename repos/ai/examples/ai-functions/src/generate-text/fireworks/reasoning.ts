import { fireworks } from '@ai-sdk/fireworks';
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: wrapLanguageModel({
      model: fireworks('accounts/fireworks/models/qwq-32b'),
      middleware: extractReasoningMiddleware({
        tagName: 'think',
        startWithReasoning: true,
      }),
    }),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log('\nREASONING:\n');
  console.log(result.reasoningText);

  console.log('\nTEXT:\n');
  console.log(result.text);

  console.log();
  console.log('Usage:', result.usage);
});
