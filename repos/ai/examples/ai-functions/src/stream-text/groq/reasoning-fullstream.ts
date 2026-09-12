import { groq, type GroqLanguageModelChatOptions } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: groq('deepseek-r1-distill-llama-70b'),
    providerOptions: {
      groq: {
        reasoningFormat: 'parsed',
      } satisfies GroqLanguageModelChatOptions,
    },
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  let enteredReasoning = false;
  let enteredText = false;
  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      if (!enteredReasoning) {
        enteredReasoning = true;
        console.log('\nREASONING:\n');
      }
      process.stdout.write(part.text);
    } else if (part.type === 'text-delta') {
      if (!enteredText) {
        enteredText = true;
        console.log('\nTEXT:\n');
      }
      process.stdout.write(part.text);
    }
  }
});
