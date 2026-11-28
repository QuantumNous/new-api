import * as z from "zod3";

const schema = z.string().min(5);
console.log(schema.parse("hi"));
