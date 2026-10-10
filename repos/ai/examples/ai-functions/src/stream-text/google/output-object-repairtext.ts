import {
  extractJsonMiddleware,
  gateway,
  Output,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { partialOutputStream } = streamText({
    model: wrapLanguageModel({
      model: gateway('google/gemini-3-flash'),
      middleware: extractJsonMiddleware(),
    }),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          ingredients: z.array(z.string()),
          quantities: z.array(z.string()),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Give me a detailed recipe for making oreo ice-cream.',
    onError: ({ error }) => {
      console.error(error);
    },
  });

  for await (const partialObject of partialOutputStream) {
    console.log(partialObject);
  }
});
