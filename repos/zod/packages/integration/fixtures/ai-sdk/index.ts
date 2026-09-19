// This file tests that the Vercel AI SDK v5 works with Zod v4 without
// "Type instantiation is excessively deep and possibly infinite" errors.

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const result = await generateObject({
  model: openai("gpt-4.1-nano"),
  prompt: "Who is or was the greatest scientist of all time?",
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
});

console.log(result);
