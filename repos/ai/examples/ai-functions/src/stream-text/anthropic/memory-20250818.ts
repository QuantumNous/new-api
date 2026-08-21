import { anthropic } from '@ai-sdk/anthropic';
import { streamText, isStepCount } from 'ai';
import { run } from '../../lib/run';
import { anthropicLocalFsMemoryTool } from '../../lib/anthropic-local-fs-memory-tool';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: `Please remember these [MEM] facts for future turns.
Acknowledge by saying "stored".
[MEM] Name: Alex Rivera
[MEM] Role: PM at Nova Robotics`,
    tools: {
      memory: anthropicLocalFsMemoryTool({ basePath: './memory' }),
    },
    stopWhen: isStepCount(10),
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }

      case 'tool-call': {
        process.stdout.write(
          `\x1b[32m\n\nTool call: '${part.toolName}'\nInput: ${JSON.stringify(part.input, null, 2)}\n\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        process.stdout.write(
          `\x1b[32m\nTool result: '${part.toolName}'\nOutput: ${JSON.stringify(part.output, null, 2)}\n\x1b[0m`,
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
