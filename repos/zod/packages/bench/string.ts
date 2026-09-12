import { makeData, makeSchema } from "./benchUtil.js";
import { metabench } from "./metabench.js";

const { zod3, zod4 } = makeSchema((z) => z.string());

const DATA = makeData(10000, () => `${Math.random()}`);
const bench = metabench("z.string().parse", {
  zod3() {
    for (const _ of DATA) zod3.parse(_);
  },
  zod4() {
    for (const _ of DATA) zod4.parse(_);
  },
});

await bench.run();
