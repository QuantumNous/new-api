import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { print } from '../../lib/print';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-opus-4-8'),
    allowSystemInMessages: true,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise math tutor. Show your reasoning step by step.',
      },
      {
        role: 'user',
        content: 'What is the derivative of f(x) = 3x^2 + 5x - 7?',
      },
      {
        role: 'assistant',
        content:
          "f'(x) = 6x + 5. I used the power rule on each term: the derivative of 3x^2 is 6x, the derivative of 5x is 5, and the derivative of the constant -7 is 0.",
      },
      {
        role: 'user',
        content: 'Now evaluate the derivative at x = 2.',
      },
      {
        role: 'system',
        content:
          'New instruction: from now on, answer in the style of a pirate while remaining mathematically correct.',
      },
    ],
  });

  printFullStream({ result });

  print('Usage:', await result.usage);
});
