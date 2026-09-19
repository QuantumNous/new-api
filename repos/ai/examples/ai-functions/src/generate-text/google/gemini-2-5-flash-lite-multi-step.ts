import { google } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash-lite'),
    // Asking for JSON without specifying `output` is brittle, but still can be useful for model testing.
    instructions:
      'You are a helpful assistant. Provide the answer in JSON format.',
    prompt: 'What are the available exams?',
    tools: {
      getExams: tool({
        description: 'Get list of available exams',
        inputSchema: z.object({}),
        execute: async () => {
          return { exams: ['Math', 'Science'] };
        },
      }),
    },
    stopWhen: isStepCount(5),
  });

  for (const [i, step] of result.steps.entries()) {
    console.log(`Step ${i}: finishReason=${step.finishReason}`);
    if (step.toolCalls.length > 0) {
      for (const call of step.toolCalls) {
        console.log(
          `  Tool call: ${call.toolName}(${JSON.stringify(call.input)})`,
        );
      }
    }
    if (step.toolResults.length > 0) {
      for (const r of step.toolResults) {
        console.log(
          `  Tool result: ${r.toolName} -> ${JSON.stringify(r.output)}`,
        );
      }
    }
    if (step.text) {
      console.log(`  Text: ${step.text}`);
    }
  }
});
