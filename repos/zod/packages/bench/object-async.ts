import { metabench } from "./metabench.js";
import { DATA, zod3, zod4 } from "./object-setup.js";

const bench = metabench("small: z.object().parseAsync", {
  async zod3() {
    for (const _ of DATA) await zod3.parseAsync(_);
  },
  async zod4() {
    for (const _ of DATA) await zod4.parseAsync(_);
  },
});

await bench.run();
