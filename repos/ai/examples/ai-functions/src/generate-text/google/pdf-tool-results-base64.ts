import { google } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../../lib/run';
import { z } from 'zod';

run(async () => {
  const readPDFDocument = tool({
    description: `Read and return a PDF document`,
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const pdfPath = path.join(__dirname, '../../../data/ai.pdf');
        const pdfData = await fs.readFile(pdfPath);

        return {
          success: true,
          description: 'Successfully loaded PDF document',
          pdfData: pdfData.toString('base64'),
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
            filename: 'ai.pdf',
            data: { type: 'data', data: output.pdfData },
          },
        ],
      };
    },
  });

  const result = await generateText({
    model: google('gemini-3-flash-preview'),
    prompt:
      'Please read the pdf document using the tool provided and return the summary of that pdf',
    tools: {
      readPDFDocument,
    },
    stopWhen: isStepCount(4),
  });

  console.log(`Assistant response : ${JSON.stringify(result.text, null, 2)}`);
});
