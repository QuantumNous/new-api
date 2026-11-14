import {
  anthropic,
  forwardAnthropicContainerIdFromLastStep,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  let stepIndex = 0;

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    stopWhen: isStepCount(20),
    prompt:
      'Two players are playing a game. ' +
      'Each round both players roll a die. ' +
      'The player with the higher roll wins the round. ' +
      'Equal rolls result in a draw. ' +
      'The first player to win 3 rounds wins the game. ' +
      'However, one player is cheating by using a loaded die. ' +
      'Use the rollDie tool to determine the outcome of each roll.',
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),

      rollDie: tool({
        description: 'Roll a die and return the result.',
        inputSchema: z.object({
          player: z.enum(['player1', 'player2']),
        }),
        execute: async ({ player }) => {
          if (player === 'player1') {
            // Simulate a loaded die that slightly skews towards 6
            const r = Math.random();
            if (r < 0.13) return 1;
            if (r < 0.26) return 2;
            if (r < 0.39) return 3;
            if (r < 0.52) return 4;
            if (r < 0.65) return 5;
            return 6;
          } else {
            return Math.floor(Math.random() * 6) + 1;
          }
        },
        providerOptions: {
          anthropic: {
            allowedCallers: ['code_execution_20250825'],
          },
        },
      }),
    },

    // Propagate container ID between steps for code execution continuity
    prepareStep: forwardAnthropicContainerIdFromLastStep,

    // Log request at each step (response body not available in streaming)
    onStepFinish: async ({ request, response }) => {
      stepIndex++;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`STEP ${stepIndex}`);
      console.log(`${'='.repeat(60)}`);

      console.log('\nRequest body:');
      console.log(JSON.stringify(request.body, null, 2));

      console.log('\nResponse:');
      console.log(JSON.stringify(response, null, 2));
    },
  });

  // Stream the text output
  process.stdout.write('\nStreaming: ');
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  // Wait for all promises to resolve
  const [text, steps] = await Promise.all([result.text, result.steps]);

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('FINAL RESULT');
  console.log(`${'='.repeat(60)}`);
  console.log('Text:', text);
  console.log('Steps:', steps.length);
});
