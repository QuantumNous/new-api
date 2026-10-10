import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import filesize from "rollup-plugin-filesize";

/** @type {import('rollup').RollupOptions} */
export default {
  input: "./scratch/input.ts", // Your TypeScript entry file
  output: {
    file: "./scratch/out_rollup.js", // Output file
    format: "esm", // ES module format to enable tree-shaking
    // sourcemap: true, // Generate sourcemaps for easier debugging
  },
  plugins: [
    resolve(), // Resolve node_modules
    commonjs(), // Convert CommonJS modules to ES6
    typescript(), // Compile TypeScript
    filesize(), // Display bundle size
  ],
  treeshake: {
    preset: "smallest",
    // preset: "recommended",
    annotations: true,
  }, // Enable tree-shaking
};
