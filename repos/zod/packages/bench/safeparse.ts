import * as z from "zod/v4";
import { metabench } from "./metabench.js";

const schema = z.object({
  string: z.string(),
  boolean: z.boolean(),
  number: z.number(),
});

const DATA = Array.from({ length: 1000 }, () =>
  Object.freeze({
    // number: Math.random(),
    // string: `${Math.random()}`,
    // boolean: Math.random() > 0.5,
  })
);

// console.log(z3Schema.parse(DATA[0]));
console.log(schema.safeParse(DATA[0]));
// console.log(v.parse(valibotSchema, DATA[0]));

const bench = metabench("safeparse vs parse — fail", {
  parse() {
    for (const d of DATA) {
      try {
        const _result = schema.parse(d);
      } catch (_e) {
        _e;
      }
    }
  },
  safeparse() {
    for (const d of DATA) {
      const result = schema.safeParse(d);
      result.error;
    }
  },
});

await bench.run();
