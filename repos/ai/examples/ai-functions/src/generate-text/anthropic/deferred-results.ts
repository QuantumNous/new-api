import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  let stepNumber = 0;

  const response = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    messages: [{ role: 'user', content: 'calculate 24*78 and weather in nyc' }],
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
      calculate: tool({
        description: 'Multiply two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => a * b,
      }),
    },
    stopWhen: isStepCount(5),
    onStepFinish: step => {
      stepNumber++;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`STEP ${stepNumber}`);
      console.log('='.repeat(60));

      // Log request info
      console.log('\n--- REQUEST ---');
      console.log('Request body:', JSON.stringify(step.request.body, null, 2));

      // Log response body
      console.log('\n--- RESPONSE BODY ---');
      console.log(JSON.stringify(step.response.body, null, 2));
    },
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL RESULT');
  console.log('='.repeat(60));
  console.log(response.text);
});
