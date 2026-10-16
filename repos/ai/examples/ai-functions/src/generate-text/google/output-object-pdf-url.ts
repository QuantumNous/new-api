import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-pro'),
    output: Output.object({
      schema: z.object({
        title: z.string(),
        authors: z.array(z.string()),
        keyPoints: z.array(z.string()),
      }),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract title, authors, and key points from the PDF.',
          },
          {
            type: 'file',
            data:
              'https://user.phil.hhu.de/~cwurm/wp-content/uploads/' +
              '2020/01/7181-attention-is-all-you-need.pdf',
            mediaType: 'application/pdf',
          },
        ],
      },
    ],
  });

  console.log(result.output);
});
