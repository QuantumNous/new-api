import { google } from '@ai-sdk/google';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        process.stdout.write(
          `Tool call: ${part.toolName}(${JSON.stringify(part.input)})\n`,
        );
        break;
      case 'tool-result':
        process.stdout.write(
          `Tool result: ${part.toolName} -> ${JSON.stringify(part.output)}\n`,
        );
        break;
      case 'finish-step':
        process.stdout.write('\n');
        process.stdout.write(`Finish step: ${part.finishReason}\n`);
        break;
      case 'finish':
        process.stdout.write('\n');
        process.stdout.write(`Finish reason: ${part.finishReason}\n`);
        break;
      case 'error':
        process.stderr.write(`Error: ${part.error}\n`);
        break;
    }
  }
});
