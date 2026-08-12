import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
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
      }),
    },
    toolChoice: 'required',
    prompt: 'Write a SQL query to get all users older than 25.',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'tool-call': {
        console.log(
          `\x1b[32m\x1b[1mTool call:\x1b[22m ${chunk.toolName}\x1b[0m`,
        );
        console.log(`  Input: ${JSON.stringify(chunk.input)}`);
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }

  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
