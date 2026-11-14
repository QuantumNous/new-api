import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });
import * as gen from "../generate.js";

console.log("╔════════════════╗");
console.log("║     Zod v4     ║");
console.log("╚════════════════╝");
await gen.generate({
  ...gen.ZOD,
  schemaType: "z.object",
  numSchemas: 500,
  numKeys: 3,
  numRefs: 1,
  // methods: [""],
});

await $`pnpm run build:bench`;
