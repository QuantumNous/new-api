import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText, isStepCount } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      bash: bedrockAnthropic.tools.bash_20241022({
        async execute({ command }) {
          console.log(`Executing command: ${command}`);
          return [
            {
              type: 'text',
              text: `
❯ ${command}
README.md     build         data          node_modules  package.json  src           tsconfig.json
`,
            },
          ];
        },
      }),
    },
    prompt: 'List the files in my directory.',
    stopWhen: isStepCount(2),
  });

  console.log('Response:', result.text);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
