import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });
import * as gen from "../generate.js";

console.log("╔════════════════╗");
console.log("║     Zod v3     ║");
console.log("╚════════════════╝");
await gen.generate({
  ...gen.ZOD3,
  numSchemas: 0,
  numKeys: 0,
  custom: `
  export const schema = z.string();
  export type schema = z.infer<typeof schema>;
  `,
});

await $`pnpm run build:bench`;

console.log("╔════════════════╗");
console.log("║     Zod v4     ║");
console.log("╚════════════════╝");
await gen.generate({
  ...gen.ZOD,
  numSchemas: 0,
  numKeys: 0,
  custom: `
  export const schema = z.string();
  export type schema = z.infer<typeof schema>;
  `,
});

await $`pnpm run build:bench`;
