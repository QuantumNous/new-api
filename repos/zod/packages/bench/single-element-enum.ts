import { zod4, zodNext } from "./benchUtil.js";
import { metabench } from "./metabench.js";

console.log("Single-element enum benchmarking");

const z4LibSchema = zod4.enum(["a"]);

const z4Schema = zodNext.enum(["a"]);

const DATA = Array.from({ length: 10000 }, () => "a");

console.log(z4Schema.parse(DATA[0]));
console.log(z4LibSchema.parse(DATA[0]));

const bench = metabench("single-element enum parse", {
  zodNext() {
    for (const _ of DATA) z4LibSchema.parse("a");
  },
  zod4() {
    for (const _ of DATA) z4Schema.parse("a");
  },
});

await bench.run();
