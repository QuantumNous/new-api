import { mistral } from '@ai-sdk/mistral';
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: wrapLanguageModel({
      model: mistral('magistral-medium-2506'),
      middleware: extractReasoningMiddleware({
        tagName: 'think',
      }),
    }),
    prompt:
      'Solve this step by step: If a train travels 60 mph for 2 hours, how far does it go?',
    maxOutputTokens: 500,
  });

  console.log('\nREASONING:\n');
  console.log(result.reasoningText);

  console.log('\nTEXT:\n');
  console.log(result.text);

  console.log();
  console.log('Usage:', result.usage);
});
