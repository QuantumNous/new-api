import { metabench } from "./metabench.js";
import { DATA, zod3, zod4 } from "./object-setup.js";

const bench = metabench("small: z.object().safeParse", {
  zod3() {
    for (const _ of DATA) zod3.safeParse(_);
  },
  zod4() {
    for (const _ of DATA) zod4.safeParse(_);
  },
});

await bench.run();
