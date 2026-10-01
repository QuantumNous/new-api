import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import * as mathjs from 'mathjs';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { text: answer } = await generateText({
    model: openai('gpt-4o-2024-08-06'),
    tools: {
      calculate: tool({
        description:
          'A tool for evaluating mathematical expressions. Example expressions: ' +
          "'1.2 * (2 + 4.5)', '12.7 cm to inch', 'sin(45 deg) ^ 2'.",
        inputSchema: z.object({ expression: z.string() }),
        execute: async ({ expression }) => mathjs.evaluate(expression),
      }),
    },
    stopWhen: isStepCount(10),
    onStepFinish: async ({ toolResults }) => {
      console.log(`STEP RESULTS: ${JSON.stringify(toolResults, null, 2)}`);
    },
    instructions:
      'You are solving math problems. ' +
      'Reason step by step. ' +
      'Use the calculator when necessary. ' +
      'The calculator can only do simple additions, subtractions, multiplications, and divisions. ' +
      'When you give the final answer, provide an explanation for how you got it.',
    prompt:
      'A taxi driver earns $9461 per 1-hour work. ' +
      'If he works 12 hours a day and in 1 hour he uses 14-liters petrol with price $134 for 1-liter. ' +
      'How much money does he earn in one day?',
  });

  console.log(`FINAL ANSWER: ${answer}`);
});
