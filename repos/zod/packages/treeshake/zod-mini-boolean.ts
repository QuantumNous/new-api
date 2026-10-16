import * as z from "zod/mini"

const schema = z.boolean();
console.log(schema.parse(true));
