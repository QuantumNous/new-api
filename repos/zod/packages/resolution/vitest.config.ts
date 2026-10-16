import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.root.mjs";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      typecheck: {
        enabled: false,
      },
    },
  })
) as object;
