import {
  extractJsonMiddleware,
  gateway,
  generateText,
  Output,
  wrapLanguageModel,
} from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { output } = await generateText({
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
          name: z.string(),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.log(output);
});
