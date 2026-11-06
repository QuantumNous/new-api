import { randomString, zod4, zodNext } from "./benchUtil.js";
import { metabench } from "./metabench.js";

console.log("Single item union");

const z4LibSchema = zod4.union([zod4.object({ value: zod4.string() })]);

const z4Schema = zodNext.union([zodNext.object({ value: zodNext.string() })]);

const DATA = Array.from({ length: 100 }, () => ({ value: randomString(15) }));

console.log(z4Schema.parse(DATA[0]));
console.log(z4LibSchema.parse(DATA[0]));

const bench = metabench("single item union", {
  zodNext() {
    z4LibSchema.parse({ value: "asdfadfs" });
  },
  zod4() {
    z4Schema.parse({ value: "asdfadfs" });
  },
});

await bench.run();
