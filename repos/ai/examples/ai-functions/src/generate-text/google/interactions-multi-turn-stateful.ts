import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Turn 1: ask about Spanish cities. The default `store: true` makes the
  // server keep the prior context so we can chain via `previousInteractionId`.
  const turn1 = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    prompt: 'What are the three largest cities in Spain?',
  });

  const interactionId = turn1.finalStep.providerMetadata?.google
    ?.interactionId as string | undefined;

  console.log('--- Turn 1 ---');
  console.log(turn1.text);
  console.log();
  console.log('Interaction id (turn 1):', interactionId);
  console.log();

  if (interactionId == null) {
    throw new Error('Turn 1 did not return an interaction id.');
  }

  // Turn 2: send ONLY the new user message + previousInteractionId. The server
  // pulls the prior context from its own state — no message history needed on
  // the wire.
  const turn2 = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    prompt: 'What is the most famous landmark in the second one?',
    providerOptions: {
      google: {
        previousInteractionId: interactionId,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('--- Turn 2 ---');
  console.log(turn2.text);
  console.log();
  console.log(
    'Interaction id (turn 2):',
    turn2.finalStep.providerMetadata?.google?.interactionId,
  );
});
