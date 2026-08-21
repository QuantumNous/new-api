import { metabench } from "./metabench.js";
import { DATA, zod3, zod4 } from "./object-setup.js";

const bench = metabench("small: z.object().safeParseAsync", {
  zod3() {
    for (const _ of DATA) zod3.parse(_);
  },
  zod4() {
    for (const _ of DATA) zod4.parse(_);
  },
});

await bench.run();
