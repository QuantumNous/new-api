import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });
import * as gen from "../generate.js";

console.log("╔═════════════════════╗");
console.log("║     Zod v3.24.2     ║");
console.log("╚═════════════════════╝");
await gen.generateExtendChain({
  ...gen.ZOD,
  numSchemas: 14,
  numKeys: 6,
  imports: ["import * as z from 'zod3-24-2'"],
});

await $`pnpm run build:bench`;

console.log("╔═════════════════════╗");
console.log("║     Zod v3.24.3     ║");
console.log("╚═════════════════════╝");
await gen.generateExtendChain({
  ...gen.ZOD,
  numSchemas: 14,
  numKeys: 6,
  imports: ["import * as z from 'zod3-24-3'"],
});

await $`pnpm run build:bench`;

console.log("╔══════════════════════╗");
console.log("║     Zod v4 (pre)     ║");
console.log("╚══════════════════════╝");
await gen.generateExtendChain({
  ...gen.ZOD,
  numSchemas: 14,
  numKeys: 6,
  imports: ["import * as z from 'zod4'"],
});

await $`pnpm run build:bench`;

console.log("╔═══════════════════════╗");
console.log("║     Zod v4 (curr)     ║");
console.log("╚═══════════════════════╝");
await gen.generateExtendChain({
  ...gen.ZOD,
  numSchemas: 14,
  numKeys: 6,
  imports: ["import * as z from 'zod'"],
});

await $`pnpm run build:bench`;
