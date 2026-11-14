import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import fs from 'node:fs';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { output } = await generateText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        artwork: z.object({
          description: z.string(),
          style: z.string(),
          review: z.string(),
        }),
      }),
    }),
    instructions: 'You are an art critic reviewing a piece of art.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail and review it' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png'),
          },
        ],
      },
    ],
  });

  console.log(JSON.stringify(output?.artwork, null, 2));
});
