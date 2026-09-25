import { makeSchema } from "./benchUtil.js";
import { metabench } from "./metabench.js";

const { zod3, zod4 } = makeSchema((z) => {
  const aSchema = z.object({
    type: z.literal("a"),
  });

  const bSchema = z.object({
    type: z.literal("b"),
  });

  const cSchema = z.object({
    type: z.literal("c"),
  });

  return z.union([aSchema, bSchema, cSchema]);
});

const DATA = { type: "c" };
const bench = metabench("z.union().parse")
  .add("zod3", () => {
    zod3.parse(DATA);
  })
  .add("zod4", () => {
    zod4.parse(DATA);
  });

await bench.run();
