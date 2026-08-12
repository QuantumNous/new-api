import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { azure } from '@ai-sdk/azure';

// Note: `providerOption` is set to `openai` (not `azure`) intentionally.
// This verifies that Azure works with OpenAI-compatible provider options.

run(async () => {
  const result = streamText({
    model: azure.responses('gpt-5.1-codex-max'),
    tools: {
      calculator: tool({
        description:
          'A minimal calculator for basic arithmetic. Call it once per step.',
        inputSchema: z.object({
          a: z.number().describe('First operand.'),
          b: z.number().describe('Second operand.'),
          op: z
            .enum(['add', 'subtract', 'multiply', 'divide'])
            .default('add')
            .describe('Arithmetic operation to perform.'),
        }),
        execute: async ({ a, b, op }) => {
          switch (op) {
            case 'add':
              return { result: a + b };
            case 'subtract':
              return { result: a - b };
            case 'multiply':
              return { result: a * b };
            case 'divide':
              if (b === 0) {
                return 'Cannot divide by zero.';
              }
              return { result: a / b };
          }
        },
      }),
    },
    stopWhen: isStepCount(20),
    providerOptions: {
      openai: {
        reasoningEffort: 'high',
        maxCompletionTokens: 32_000,
        store: false,
        include: ['reasoning.encrypted_content'],
        reasoningSummary: 'auto',
      },
    },
    messages: [
      {
        role: 'user',
        content:
          'Use the calculator tool to add 12 and 7, then multiply that sum by 3 then multiply by 10. Call the tool separately for each arithmetic step and only 1 tool call per step and report the final result.',
      },
    ],
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'reasoning-start':
        process.stdout.write('\x1b[34m');
        break;

      case 'reasoning-delta':
        process.stdout.write(chunk.text);
        break;

      case 'reasoning-end':
        process.stdout.write('\x1b[0m');
        process.stdout.write('\n');
        console.log('providerMetadata:', chunk.providerMetadata);
        process.stdout.write('\n');
        break;

      case 'text-start':
        process.stdout.write('\x1b[0m');
        break;

      case 'text-delta':
        process.stdout.write(chunk.text);
        break;

      case 'text-end':
        process.stdout.write('\x1b[0m');
        console.log();
        break;
    }
  }
});
