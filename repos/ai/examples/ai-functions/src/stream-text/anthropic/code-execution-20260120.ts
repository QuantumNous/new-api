import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    prompt:
      'Write a Python script to calculate fibonacci number' +
      ' and then execute it to find the 10th fibonacci number',
    tools: {
      code_execution: anthropic.tools.codeExecution_20260120(),
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }

      case 'tool-call': {
        process.stdout.write(
          `\n\nTool call: '${part.toolName}'\nInput: ${JSON.stringify(part.input, null, 2)}\n`,
        );
        break;
      }

      case 'tool-result': {
        process.stdout.write(
          `\nTool result: '${part.toolName}'\nOutput: ${JSON.stringify(part.output, null, 2)}\n`,
        );
        break;
      }

      case 'error': {
        console.error('\n\nCode execution error:', part.error);
        break;
      }
    }
  }

  process.stdout.write('\n\n');
});
