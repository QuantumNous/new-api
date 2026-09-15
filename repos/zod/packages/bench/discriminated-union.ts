import { makeData, randomPick, randomString } from "./benchUtil.js";
import { metabench } from "./metabench.js";

import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import * as z4lib from "zod4/v4";

const z3fields = {
  data1: z3.string(),
  data2: z3.string(),
  data3: z3.string(),
  // data4: z3.string(),
  // data5: z3.string(),
  // data6: z3.string(),
  // data7: z3.string(),
  // data8: z3.string(),
  // data9: z3.string(),
  // data10: z3.string(),
};
const z3Union = z3.union([
  z3.object({
    type: z3.literal("a"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("b"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("c"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("d"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("e"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("f"),
    ...z3fields,
  }),
  z3.object({
    type: z3.literal("g"),
    ...z3fields,
  }),
]);

const z3DiscUnion = z3.discriminatedUnion("type", z3Union._def.options);

function makeSchema(z: typeof z4) {
  const z4fields = {
    data1: z.string(),
    data2: z.string(),
    data3: z.string(),
    // data4: z.string(),
    // data5: z.string(),
    // data6: z.string(),
    // data7: z.string(),
    // data8: z.string(),
    // data9: z.string(),
    // data10: z.string(),
  };
  const z4Union = z.union([
    z.object({
      type: z.literal("a"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("b"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("c"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("d"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("e"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("f"),
      ...z4fields,
    }),
    z.object({
      type: z.literal("g"),
      ...z4fields,
    }),
  ]);
  return z4Union;
}

const z4Union = makeSchema(z4);
const z4LibUnion = makeSchema(z4lib as any);
const z4LibDiscUnion = z4lib.discriminatedUnion("type", z4LibUnion._def.options as any);
const z4DiscUnion = z4.discriminatedUnion("type", z4Union.def.options);

const DATA = makeData(100, () => ({
  type: randomPick(["a", "b", "c", "d", "e", "f", "g"]),
  data1: randomString(10),
  data2: randomString(10),
  data3: randomString(10),
  // data4: randomString(10),
  // data5: randomString(10),
  // data6: randomString(10),
  // data7: randomString(10),
  // data8: randomString(10),
  // data9: randomString(10),
  // data10: randomString(10),
}));

console.dir(DATA[0], { depth: null });
console.dir(z3Union.parse(DATA[0]), { depth: null });
console.dir(z3DiscUnion.parse(DATA[0]), { depth: null });
console.dir(z4Union.parse(DATA[0]), { depth: null });
console.dir(z4DiscUnion.parse(DATA[0]), { depth: null });
console.dir(z4LibUnion.parse(DATA[0]), { depth: null });
console.dir(z4LibDiscUnion.parse(DATA[0]), { depth: null });

const bench = metabench("z.discriminatedUnion().parse", {
  // z3() {
  //   for (const item of DATA) {
  //     z3Union.parse(item);
  //   }
  // },
  "zod 3"() {
    for (const item of DATA) {
      z3DiscUnion.parse(item);
    }
  },
  // z4() {
  //   for (const item of DATA) {
  //     z4Union.parse(item);
  //   }
  // },
  // z4jitless() {
  //   for (const item of DATA) {
  //     z4Union.parse(item, args);
  //   }
  // },
  "zod 4 (after)"() {
    for (const item of DATA) {
      z4DiscUnion.parse(item);
    }
  },
  "zod 4 (before)"() {
    for (const item of DATA) {
      z4LibDiscUnion.parse(item);
    }
  },
});

await bench.run();
