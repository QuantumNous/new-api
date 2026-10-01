import { defineProject, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.root.mjs";

export default mergeConfig(
  rootConfig,
  defineProject({
    test: {
      environment: "node",
      typecheck: {
        tsconfig: "./tsconfig.test.json",
      },
    },
  })
);
