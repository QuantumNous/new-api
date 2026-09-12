import { run } from '../../lib/run';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText, isStepCount } from 'ai';

run(async () => {
  const result = await generateText({
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
    tools: {
      bash: vertexAnthropic.tools.bash_20241022({
        async execute({ command }) {
          console.log('COMMAND', command);
          return [
            {
              type: 'text',
              text: `
          ❯ ls
          README.md     build         data          node_modules  package.json  src           tsconfig.json
          `,
            },
          ];
        },
      }),
    },
    prompt: 'List the files in my home directory.',
    stopWhen: isStepCount(2),
  });

  console.log(result.text);
});
