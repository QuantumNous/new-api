import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai.responses('gpt-5-codex'),
    tools: {
      local_shell: openai.tools.localShell({
        execute: async ({ action }) => {
          console.log('ACTION');
          console.dir(action, { depth: Infinity });

          const stdout = `
❯ ls
README.md     build         data          node_modules  package.json  src           tsconfig.json
          `;

          return { output: stdout };
        },
      }),
    },
    prompt: 'List the files in my home directory.',
    stopWhen: isStepCount(2),
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\x1b[32m\x1b[1mTool call:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\x1b[32m\x1b[1mTool result:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
