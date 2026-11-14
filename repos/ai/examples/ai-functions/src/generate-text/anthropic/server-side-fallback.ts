import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-fable-5'),
    prompt: 'Tell me about the history of the printing press.',
    providerOptions: {
      anthropic: {
        // If the primary model's classifiers block the turn, the API retries
        // it server-side on the fallback model. The required beta header is
        // added automatically.
        fallbacks: [{ model: 'claude-opus-4-8' }],
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  console.log('Answered by:', result.finalStep.response.modelId);
  console.log();
  console.log('Text:');
  console.log(result.text);
  console.log();

  // Per-model attribution lives in the Anthropic-specific usage iterations.
  // A `fallback_message` iteration means a fallback model served the turn.
  const iterations = result.finalStep.providerMetadata?.anthropic?.iterations;
  console.log('Usage iterations:', JSON.stringify(iterations, null, 2));
});
