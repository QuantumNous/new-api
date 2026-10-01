import * as z from "zod/v4";

const schema = z.boolean();
console.log(schema.parse(true));
