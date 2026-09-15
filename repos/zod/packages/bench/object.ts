import * as v from "valibot";
import * as z4 from "zod/v4";
import * as z3 from "zod3";
import { metabench } from "./metabench.js";

const z3Schema = z3.object({
  string: z3.string(),
  boolean: z3.boolean(),
  number: z3.number(),
});

const z4Schema = z4.object({
  string: z4.string(),
  boolean: z4.boolean(),
  number: z4.number(),
});

const valibotSchema = v.object({
  string: v.string(),
  boolean: v.boolean(),
  number: v.number(),
});

const DATA = Array.from({ length: 1000 }, () =>
  Object.freeze({
    number: Math.random(),
    string: `${Math.random()}`,
    boolean: Math.random() > 0.5,
  })
);

console.log(z3Schema.parse(DATA[0]));
console.log(z4Schema.parse(DATA[0]));
console.log(v.parse(valibotSchema, DATA[0]));

const bench = metabench("z.object().parse", {
  zod3() {
    for (const d of DATA) z3Schema.parse(d);
  },
  zod4() {
    for (const d of DATA) z4Schema.parse(d);
  },
  valibot() {
    for (const d of DATA) v.parse(valibotSchema, d);
  },
});

await bench.run();
