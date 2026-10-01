import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt:
      'Write a Python script to calculate fibonacci number' +
      ' and then execute it to find the 10th fibonacci number',
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
    },
  });

  console.dir(result.content, { depth: Infinity });
});
