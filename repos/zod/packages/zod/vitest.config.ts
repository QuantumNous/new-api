import { defineProject, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config.js";

export default mergeConfig(
  rootConfig,
  defineProject({
    resolve: {
      conditions: ["@zod/source", "default"],
    },
    test: {
      typecheck: {
        tsconfig: "./tsconfig.test.json",
      },
    },
  })
);
