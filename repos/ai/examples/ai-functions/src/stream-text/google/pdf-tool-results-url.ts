import { google } from '@ai-sdk/google';
import { isStepCount, streamText, tool } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

run(async () => {
  const readPDFDocument = tool({
    description: `Read and return a PDF document`,
    inputSchema: z.object({}),
    execute: async () => {
      return {
        description: 'Successfully loaded PDF document',
        // This example currently does not work, neither with `google` nor with `vertex`, despite
        // https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling#functionresponsepart docs.
        // The API doesn't error, but the model clearly doesn't see the image because it makes up something else.
        pdfUrl:
          'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf?raw=true',
      };
    },
    toModelOutput({ output }) {
      return {
        type: 'content',
        value: [
          {
            type: 'text',
            text: output.description,
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: { type: 'url', url: new URL(output.pdfUrl) },
          },
        ],
      };
    },
  });

  const result = streamText({
    model: google('gemini-3-flash-preview'),
    prompt:
      'Please read the pdf document using the tool provided and return the summary of that pdf',
    tools: {
      readPDFDocument,
    },
    stopWhen: isStepCount(4),
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
