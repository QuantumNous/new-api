import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import {
  isStepCount,
  streamText,
  type ToolCallPart,
  type ToolResultPart,
} from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      bash: bedrockAnthropic.tools.bash_20241022({
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

  let fullResponse = '';
  const toolCalls: ToolCallPart[] = [];
  const toolResponses: ToolResultPart[] = [];

  for await (const delta of result.stream) {
    switch (delta.type) {
      case 'text-delta': {
        fullResponse += delta.text;
        process.stdout.write(delta.text);
        break;
      }

      case 'tool-call': {
        toolCalls.push(delta);

        process.stdout.write(
          `\nTool call: '${delta.toolName}' ${JSON.stringify(delta.input)}`,
        );
        break;
      }

      case 'tool-result': {
        const transformedDelta: ToolResultPart = {
          ...delta,
          output: { type: 'json', value: delta.output as any },
        };
        toolResponses.push(transformedDelta);

        process.stdout.write(
          `\nTool response: '${delta.toolName}' ${JSON.stringify(
            delta.output,
          )}`,
        );
        break;
      }
    }
  }
  process.stdout.write('\n\n');

  console.log();
  console.log('Warnings: ', await result.warnings);
  console.log('Sources:', await result.sources);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);

  const sources = await result.sources;
  for (const source of sources) {
    if (source.sourceType === 'url') {
      console.log('Source URL:', source.url);
      console.log('Title:', source.title);
      console.log();
    }
  }
});
