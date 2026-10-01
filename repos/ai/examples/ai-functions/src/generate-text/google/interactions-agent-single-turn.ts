import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  // Ctrl+C aborts the call, which fires `POST /interactions/{id}/cancel` on
  // Google's side so the agent stops billing instead of running to
  // completion in the background.
  const ac = cancelOnSigint();

  // The deep-research agent runs a multi-step research workflow on the
  // server. Expect this call to take a while (often a minute or more).
  const result = await generateText({
    model: google.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    prompt:
      'Briefly summarize the most-cited papers on retrieval-augmented generation since 2024 (2-3 sentences).',
    abortSignal: ac.signal,
    providerOptions: {
      google: {
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log(
    'Interaction id:',
    result.finalStep.providerMetadata?.google?.interactionId,
  );
});
