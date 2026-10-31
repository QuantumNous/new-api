import * as z from "valibot";

const schema = z.pipe(z.string(), z.minLength(1));
console.log(z.parse(schema, "hi"));
