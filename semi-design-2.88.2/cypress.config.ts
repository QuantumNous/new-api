import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "k83u7j",
  scrollBehavior: false,
  video: false,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require("./cypress/plugins/index.js")(on, config);
    },
    specPattern: "cypress/e2e/**/*.{js,jsx,ts,tsx}",
    experimentalRunAllSpecs: true,
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "webpack",
    },
  },
});
