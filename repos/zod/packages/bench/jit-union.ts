import { makeData, randomPick, randomString } from "./benchUtil.js";
import { metabench } from "./metabench.js";

import * as z4 from "zod/mini";

const z4fields = {
  data1: z4.string(),
  data2: z4.string(),
  data3: z4.string(),
  data4: z4.string(),
  data5: z4.string(),
  data6: z4.string(),
  data7: z4.string(),
  data8: z4.string(),
  data9: z4.string(),
  data10: z4.string(),
};
const z4Union = z4.union([
  z4.object({
    type: z4.literal("a"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("b"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("c"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("d"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("e"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("f"),
    ...z4fields,
  }),
  z4.object({
    type: z4.literal("g"),
    ...z4fields,
  }),
]);

const DATA = makeData(100, () => ({
  type: randomPick(["a", "b", "c", "d", "e", "f", "g"]),
  data1: randomString(10),
  data2: randomString(10),
  data3: randomString(10),
  data4: randomString(10),
  data5: randomString(10),
  data6: randomString(10),
  data7: randomString(10),
  data8: randomString(10),
  data9: randomString(10),
  data10: randomString(10),
}));

const args = { jitless: true };
console.dir(z4Union.parse(DATA[0]), { depth: null });
console.dir(z4Union.parse(DATA[0], args), { depth: null });
const bench = metabench("z.discriminatedUnion().parse", {
  v4_jit() {
    for (const item of DATA) {
      z4Union.parse(item);
    }
  },
  v4_jitless() {
    for (const item of DATA) {
      z4Union.parse(item, args);
    }
  },
});

await bench.run();
