import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { isStepCount, streamText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    } else if (part.type === 'tool-call') {
      console.log(
        `\nTool call: ${part.toolName}(${JSON.stringify(part.input)})`,
      );
    } else if (part.type === 'tool-result') {
      console.log(
        `Tool result: ${JSON.stringify(part.output).substring(0, 100)}...`,
      );
    }
  }

  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
