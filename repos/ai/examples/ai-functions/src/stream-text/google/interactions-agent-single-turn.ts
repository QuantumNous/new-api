import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  // Ctrl+C aborts the stream, which fires `POST /interactions/{id}/cancel`
  // on Google's side so the agent stops billing instead of running to
  // completion in the background.
  const ac = cancelOnSigint();

  // The deep-research agent runs a multi-step research workflow on the
  // server. Expect this call to take a while (often a minute or more). With
  // `thinkingSummaries: 'auto'` the agent emits intermediate reasoning
  // events as it works -- printed dimmed below alongside the final answer.
  const result = streamText({
    model: google.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    providerOptions: {
      google: {
        agentConfig: {
          type: 'deep-research',
          thinkingSummaries: 'auto',
        },
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
    prompt:
      'Briefly summarize the most-cited papers on retrieval-augmented generation since 2024 (2-3 sentences).',
    abortSignal: ac.signal,
  });

  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write(`\x1b[2m${part.text}\x1b[0m`);
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
  console.log();

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log(
    'Interaction id:',
    (await result.finalStep).providerMetadata?.google?.interactionId,
  );
});
