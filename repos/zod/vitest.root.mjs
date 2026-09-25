import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ["@zod/source", "default"],
  },
  ssr: {
    resolve: {
      conditions: ["@zod/source", "default"],
      externalConditions: ["@zod/source", "default"],
    },
  },
  test: {
    watch: false,
    isolate: true,
    setupFiles: [resolve(__dirname, "scripts/fail-on-console.ts")],
    typecheck: {
      include: ["**/*.test.ts"],
      enabled: true,
      ignoreSourceErrors: false,
      checker: "tsc",
      tsconfig: "./tsconfig.json",
    },
    silent: true,
  },
});
