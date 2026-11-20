import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText, type ModelMessage } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  /*
   * Stateless multi-turn with reasoning enabled. Because we pass `store: false`
   * and re-send the full message history each turn, the assistant's prior
   * reasoning blocks — including their `thoughtSignature` — must round-trip
   * back to the API verbatim on turn 2. If a signature is missing or corrupted
   * the server rejects the request, so a successful follow-up confirms that
   * thought signatures are preserved correctly.
   */
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content:
        'A train leaves Boston at 8:00 AM travelling at 60 mph. Another ' +
        'train leaves New York (215 miles away) at 9:00 AM travelling at ' +
        '75 mph toward Boston. Where do they meet?',
    },
  ];

  const turn1 = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    messages,
    reasoning: 'medium',
    providerOptions: {
      google: {
        store: false,
        thinkingSummaries: 'auto',
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('--- Turn 1 ---');
  if (turn1.reasoningText) {
    console.log('\x1b[34m' + turn1.reasoningText + '\x1b[0m');
  }
  console.log(turn1.text);
  console.log();

  messages.push(...turn1.responseMessages);
  messages.push({
    role: 'user',
    content:
      'How long after the New York train departs does the meeting happen?',
  });

  const turn2 = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    messages,
    reasoning: 'medium',
    providerOptions: {
      google: {
        store: false,
        thinkingSummaries: 'auto',
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('--- Turn 2 ---');
  if (turn2.reasoningText) {
    console.log('\x1b[34m' + turn2.reasoningText + '\x1b[0m');
  }
  console.log(turn2.text);
});
