import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  // Ctrl+C aborts the in-flight call, which fires
  // `POST /interactions/{id}/cancel` on Google's side so the agent stops
  // billing instead of running to completion in the background.
  const ac = cancelOnSigint();

  // Turn 1: ask the deep-research agent to identify key topics. Default
  // `store: true` keeps server-side context so we can chain via
  // `previousInteractionId`. Note: agent calls can be slow.
  console.log('--- Turn 1 ---');
  const turn1 = await generateText({
    model: google.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    prompt:
      'List three foundational concepts behind transformer-based language models (one sentence each).',
    abortSignal: ac.signal,
    providerOptions: {
      google: {
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  const interactionId = turn1.finalStep.providerMetadata?.google
    ?.interactionId as string | undefined;

  console.log(turn1.text);
  console.log();
  console.log('Interaction id (turn 1):', interactionId);
  console.log();

  if (interactionId == null) {
    throw new Error('Turn 1 did not return an interaction id.');
  }

  // Turn 2: send ONLY the new user message + previousInteractionId. The
  // server pulls the prior agent context from its own state — no message
  // history needs to be re-sent.
  console.log('--- Turn 2 ---');
  const turn2 = await generateText({
    model: google.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    prompt:
      'Of those three, which one was the most novel contribution at the time? Answer in 1-2 sentences.',
    providerOptions: {
      google: {
        previousInteractionId: interactionId,
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
    abortSignal: ac.signal,
  });

  console.log(turn2.text);
  console.log();
  console.log(
    'Interaction id (turn 2):',
    turn2.finalStep.providerMetadata?.google?.interactionId,
  );
});
