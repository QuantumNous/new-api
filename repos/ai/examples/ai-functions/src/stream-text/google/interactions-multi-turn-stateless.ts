import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText, type ModelMessage } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Stateless multi-turn: pass `store: false` and re-send the full conversation
  // history every turn. Nothing is persisted on Google's side; the wire body
  // contains the entire history and `store: false`, with no
  // `previous_interaction_id`.
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content: 'What are the three largest cities in Spain?',
    },
  ];

  console.log('--- Turn 1 ---');
  const turn1 = streamText({
    model: google.interactions('gemini-2.5-flash'),
    messages,
    providerOptions: {
      google: { store: false } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });
  for await (const textPart of turn1.textStream) {
    process.stdout.write(textPart);
  }
  console.log();
  console.log();
  console.log(
    'Interaction id (turn 1):',
    (await turn1.providerMetadata)?.google?.interactionId,
  );
  console.log();

  // Append the assistant turn from turn 1 onto the local message history, then
  // send a follow-up that depends on turn 1's context. With `store: false`, the
  // server has no prior state to fall back on — the model must reconstruct the
  // context from the messages we re-send.
  messages.push(...(await turn1.response).messages);
  messages.push({
    role: 'user',
    content: 'What is the most famous landmark in the second one?',
  });

  console.log('--- Turn 2 ---');
  const turn2 = streamText({
    model: google.interactions('gemini-2.5-flash'),
    messages,
    providerOptions: {
      google: { store: false } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });
  for await (const textPart of turn2.textStream) {
    process.stdout.write(textPart);
  }
  console.log();
  console.log();
  console.log(
    'Interaction id (turn 2):',
    (await turn2.providerMetadata)?.google?.interactionId,
  );
});
