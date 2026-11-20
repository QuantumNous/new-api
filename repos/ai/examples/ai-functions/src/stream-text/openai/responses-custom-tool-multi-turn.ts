import { openai } from '@ai-sdk/openai';
import { streamText, isStepCount } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'tool-call': {
        console.log(`Tool call: ${chunk.toolName}`);
        console.log(`  Input: ${JSON.stringify(chunk.input)}`);
        break;
      }
      case 'tool-result': {
        console.log(`Tool result: ${JSON.stringify(chunk.output)}`);
        break;
      }
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }
    }
  }

  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Steps:', (await result.steps).length);
});
