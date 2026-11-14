import * as z from "zod/v4";

const schema = z.string().min(5);
console.log(schema.parse("hi"));

