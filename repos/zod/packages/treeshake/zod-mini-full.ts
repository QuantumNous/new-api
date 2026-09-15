import * as z from "zod/mini"

export const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.boolean(),
});

