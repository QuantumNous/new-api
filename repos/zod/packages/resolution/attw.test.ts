import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Are The Types Wrong (attw) tests", () => {
  it("should run attw --pack node_modules/zod and check output", async () => {
    // check if node_modules/zod/index.js exists
    const zodIndexPath = path.join(__dirname, "node_modules", "zod", "index.js");
    if (!existsSync(zodIndexPath)) {
      // Zod has not been build
      return;
    }

    // Check if attw is available before running the test
    try {
      await execa("pnpm", ["attw", "--version"], {
        cwd: __dirname,
        timeout: 5000,
      });
    } catch (_: any) {
      console.warn("attw not available, skipping test");
      return;
    }

    const zodPackagePath = path.join(__dirname, "node_modules", "zod");
    const result = await execa("pnpm", ["attw", "--pack", zodPackagePath, "--format", "ascii"], {
      cwd: __dirname,
      reject: false, // Don't throw on non-zero exit codes
    });

    // Combine stdout and stderr for comprehensive output
    const output = result.stdout + (result.stderr ? "\n" + result.stderr : "");
    // remove first line
    const outputWithoutFirstLine = output.split("\n").slice(2).join("\n").trim();
    expect(outputWithoutFirstLine).toMatchInlineSnapshot(`
      "🎭 Import resolved to a CommonJS type declaration file, but an ESM JavaScript file. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/FalseCJS.md


      "zod/package.json"

      node10: 🟢 (JSON)
      node16 (from CJS): 🟢 (JSON)
      node16 (from ESM): 🟢 (JSON)
      bundler: 🟢 (JSON)

      ***********************************

      "zod"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/mini"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/locales"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v3"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4-mini"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4/mini"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4/core"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4/locales"

      node10: 🟢 
      node16 (from CJS): 🟢 (CJS)
      node16 (from ESM): 🎭 Masquerading as CJS
      bundler: 🟢 

      ***********************************

      "zod/v4/locales/*"

      node10: (wildcard)
      node16 (from CJS): (wildcard)
      node16 (from ESM): (wildcard)
      bundler: (wildcard)

      ***********************************"
    `);
  }, 120000); // 30 second timeout for the command
});
