import { makeData, makeSchema } from "./benchUtil.js";
import { metabench } from "./metabench.js";

const { zod3, zod4 } = makeSchema((z) => z.string().datetime());
const DATA = makeData(10000, () => new Date().toISOString());

const bench = metabench("z.string().datetime().parse", {
  zod3() {
    for (const _ of DATA) zod3.parse(_);
  },
  zod4() {
    for (const _ of DATA) zod4.parse(_);
  },
});

await bench.run();
