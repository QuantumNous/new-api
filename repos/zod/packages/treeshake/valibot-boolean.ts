import * as z from "valibot";

const schema = z.boolean()
console.log(z.parse(schema, "hi"));
