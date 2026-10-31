// @ts-nocheck
import z from 'zod';
import { generateText } from 'ai';

const schema = z.object({
  name: z.string(),
  age: z.number(),
});

export { schema };
