import * as z from "zod/mini"

const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() });

schema.parse({
  a: "asdf",
  b: 123,
  c: true,
});
