import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertex('gemini-2.5-pro'),
    tools: { code_execution: googleVertex.tools.codeExecution({}) },
    maxOutputTokens: 2048,
    prompt:
      'Use python to calculate 20th fibonacci number. Then find the nearest palindrome to it.',
  });

  console.log(JSON.stringify(result, null, 2));
});
