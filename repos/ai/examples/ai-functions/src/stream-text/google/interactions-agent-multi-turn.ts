import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  // Ctrl+C aborts the in-flight stream, which fires
  // `POST /interactions/{id}/cancel` on Google's side so the agent stops
  // billing instead of running to completion in the background.
  const ac = cancelOnSigint();

  // Turn 1: ask the deep-research agent to identify key topics. Default
  // `store: true` keeps server-side context so we can chain via
  // `previousInteractionId`. Note: agent calls can be slow. With
  // `thinkingSummaries: 'auto'` the agent emits intermediate reasoning
  // events as it works -- printed dimmed below alongside the final answer.
  console.log('--- Turn 1 ---');
  const turn1 = streamText({
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
      'List three foundational concepts behind transformer-based language models (one sentence each).',
    abortSignal: ac.signal,
  });
  for await (const part of turn1.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write(`\x1b[2m${part.text}\x1b[0m`);
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
  console.log();

  const interactionId = (await turn1.providerMetadata)?.google?.interactionId as
    | string
    | undefined;
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
  const turn2 = streamText({
    model: google.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    prompt:
      'Of those three, which one was the most novel contribution at the time? Answer in 1-2 sentences.',
    providerOptions: {
      google: {
        previousInteractionId: interactionId,
        agentConfig: {
          type: 'deep-research',
          thinkingSummaries: 'auto',
        },
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
    abortSignal: ac.signal,
  });
  for await (const part of turn2.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write(`\x1b[2m${part.text}\x1b[0m`);
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
  console.log();
  console.log();
  console.log(
    'Interaction id (turn 2):',
    (await turn2.providerMetadata)?.google?.interactionId,
  );
});
