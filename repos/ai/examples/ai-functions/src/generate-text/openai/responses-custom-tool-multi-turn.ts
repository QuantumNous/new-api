import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.2-codex'),
    tools: {
      write_sql: openai.tools.customTool({
        description: 'Write a SQL SELECT query to answer the user question.',
        format: {
          type: 'grammar',
          syntax: 'regex',
          definition: 'SELECT .+',
        },
        execute: async input => {
          console.log(`Executing SQL: ${input}`);
          return `3 rows returned: Alice (30), Bob (28), Charlie (35)`;
        },
      }),
    },
    prompt: 'How many users are older than 25? Use SQL to find out.',
    stopWhen: isStepCount(3),
  });

  const allToolCalls = result.steps.flatMap(step => step.toolCalls);
  const allToolResults = result.steps.flatMap(step => step.toolResults);

  print('Text:', result.text);
  print('Steps:', result.steps.length);
  print('Tool calls (final step):', result.toolCalls);
  print('Tool results (final step):', result.toolResults);
  print('Tool calls (all steps):', allToolCalls);
  print('Tool results (all steps):', allToolResults);
});
