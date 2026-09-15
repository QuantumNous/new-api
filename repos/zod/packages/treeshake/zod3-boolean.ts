import * as z from "zod3";

const schema = z.boolean();
console.log(schema.parse(true));
