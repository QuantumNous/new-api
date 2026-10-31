import * as z from "valibot";

const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() });
console.log(
  z.parse(schema, {
    a: "asdf",
    b: 123,
    c: true,
  })
);
