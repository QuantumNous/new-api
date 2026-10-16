import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });
import * as gen from "../generate.js";

const SHARED = {
  numSchemas: 500,
  numKeys: 5,
  numExtends: 1,
};
console.log("╔════════════════╗");
console.log("║     Zod v3     ║");
console.log("╚════════════════╝");
await gen.generate({
  ...gen.ZOD3,
  schemaType: "z.object",
  ...SHARED,
});

await $`pnpm run build:bench`;

console.log("╔════════════════╗");
console.log("║     Zod v4     ║");
console.log("╚════════════════╝");
await gen.generate({
  ...gen.ZOD,
  schemaType: "z.object",
  ...SHARED,
});

await $`pnpm run build:bench`;

// console.log("╔═════════════════╗");
// console.log("║     ArkType     ║");
// console.log("╚═════════════════╝");
// await gen.generate({
// gen.  ...ARKTYPE,
//   ...SHARED
// });

// await $`pnpm run build:bench`;
