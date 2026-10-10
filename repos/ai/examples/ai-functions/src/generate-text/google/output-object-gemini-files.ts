import { GoogleAIFileManager } from '@google/generative-ai/server';
import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import path from 'path';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const fileManager = new GoogleAIFileManager(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  );

  const filePath = path.resolve(__dirname, '../../data/ai.pdf');

  const geminiFile = await fileManager.uploadFile(filePath, {
    name: `ai-${Math.random().toString(36).substring(7)}`,
    mimeType: 'application/pdf',
  });

  const result = await generateText({
    model: google('gemini-2.5-pro'),
    output: Output.object({
      schema: z.object({
        title: z.string(),
        keyPoints: z.array(z.string()),
      }),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract title and key points from the PDF.',
          },
          {
            type: 'file',
            data: geminiFile.file.uri,
            mediaType: geminiFile.file.mimeType,
          },
        ],
      },
    ],
  });

  console.log(result.output);
});
