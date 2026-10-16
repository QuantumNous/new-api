import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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
    onStepFinish: step => {
      console.dir(step.content, { depth: Infinity });
    },
  });
});
