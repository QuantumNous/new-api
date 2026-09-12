import { generateText, isStepCount, tool } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

run(async () => {
  const readPDFDocument = tool({
    description: `Read and return a PDF document`,
    inputSchema: z.object({}),
    execute: async () => {
      try {
        return {
          success: true,
          description: 'Successfully loaded PDF document',
          pdfUrl:
            'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/ai.pdf?raw=true',
        };
      } catch (error) {
        throw new Error(`Failed to analyze PDF: ${error}`);
      }
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

  const result = await generateText({
    model: anthropic('claude-sonnet-4-0'),
    prompt:
      'Please read the pdf document using the tool provided and return the summary of that pdf',
    tools: {
      readPDFDocument,
    },
    stopWhen: isStepCount(4),
  });

  console.log(`Assisstant response : ${JSON.stringify(result.text, null, 2)}`);
});
