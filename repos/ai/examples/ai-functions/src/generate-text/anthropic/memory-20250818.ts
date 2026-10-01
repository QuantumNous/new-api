import { anthropic } from '@ai-sdk/anthropic';
import { isStepCount, generateText } from 'ai';
import { run } from '../../lib/run';
import { anthropicLocalFsMemoryTool } from '../../lib/anthropic-local-fs-memory-tool';

run(async () => {
  const result = await generateText({
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

  console.dir(result.content, { depth: Infinity });
});
