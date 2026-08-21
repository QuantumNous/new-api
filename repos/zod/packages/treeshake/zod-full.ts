import * as z from "zod/v4";

export const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.boolean(),
});
