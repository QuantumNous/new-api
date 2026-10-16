import { google } from '@ai-sdk/google';
import { Output, streamText } from 'ai';
import fs from 'node:fs';
import { z } from 'zod';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result1 = streamText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
    output: Output.object({
      schema: z.object({
        error: z.string(),
        stack: z.string(),
      }),
    }),
  });

  for await (const _ of result1.partialOutputStream) {
    void _;
  }

  const providerMetadata1 = await result1.providerMetadata;
  console.log(providerMetadata1?.google);

  const result2 = streamText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
    output: Output.object({
      schema: z.object({
        error: z.string(),
        stack: z.string(),
      }),
    }),
  });

  for await (const _ of result2.partialOutputStream) {
    void _;
  }

  const providerMetadata2 = await result2.providerMetadata;
  console.log(providerMetadata2?.google);
});
