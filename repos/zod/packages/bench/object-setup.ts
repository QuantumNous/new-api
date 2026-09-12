import { makeData, makeSchema } from "./benchUtil.js";
// import { metabench } from "./metabench.js";

export const { zod3, zod4 } = makeSchema((z) =>
  z.object({
    string: z.string(),
    boolean: z.boolean(),
    number: z.number(),
  })
);

// biome-ignore lint/style/noVar: <explanation>
// biome-ignore lint/correctness/noInnerDeclarations: <explanation>
export var DATA: any[] = makeData(1000, () => {
  return Object.freeze({
    number: Math.random(),
    string: `${Math.random()}`,
    boolean: Math.random() > 0.5,
  });
});

// const bench = metabench("small: z.object().parse", {
//   zod3() {
//     for (const d of DATA) {
//       zod3.parse(d);
//     }
//   },
//   zod4() {
//     for (const d of DATA) {
//       zod4.parse(d);
//     }
//   },
// });

// await bench.run();
