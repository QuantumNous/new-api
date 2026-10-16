import { makeData } from "./benchUtil.js";
import { metabench } from "./metabench.js";

import * as z from "zod/v3";
import * as z4 from "zod/v4";

const a = z4.object({ a: z4.string() });
const b = z.object({ a: z.string() });

const DATA = makeData(10000, () => ({ b: `${Math.random()}` }));

const bench = metabench("safeparse error", {
  zod4() {
    for (const _ of DATA) {
      try {
        a.safeParse(_);
      } catch (_e) {
        _e;
      }
    }
  },
  zod4new() {
    for (const _ of DATA) {
      try {
        b.safeParse(_);
      } catch (_e) {
        _e;
      }
    }
  },
});

await bench.run();
