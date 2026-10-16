import {
  amazonBedrock,
  type AmazonBedrockLanguageModelChatOptions,
} from '@ai-sdk/amazon-bedrock';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('us.anthropic.claude-sonnet-4-20250514-v1:0'),
    output: Output.object({
      schema: z.object({
        summary: z.string().describe('Summary of the PDF document'),
        keyPoints: z.array(z.string()).describe('Key points from the PDF'),
      }),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Summarize this PDF and provide key points.',
          },
          {
            type: 'file',
            data: fs.readFileSync('./data/ai.pdf'),
            mediaType: 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: { enabled: true },
              },
            },
          },
        ],
      },
    ],
  });

  console.log('Response:', JSON.stringify(result, null, 2));
});
