import path from 'node:path';
import { color } from '../helpers';
import type { RsbuildPlugin } from '../types';

const getFilename = (resourcePath: string) => {
  const name = resourcePath && path.parse(resourcePath).name;
  return name ? `${name}.node` : null;
};

export const pluginNodeAddons = (): RsbuildPlugin => ({
  name: 'rsbuild:node-addons',

  setup(api) {
    api.transform(
      { test: /\.node$/, targets: ['node'], raw: true },
      ({ code, emitFile, resourcePath }) => {
        const filename = getFilename(resourcePath);

        if (filename === null) {
          throw new Error(
            `${color.dim('[rsbuild:nodeAddons]')} Failed to load Node.js addon: ${color.yellow(resourcePath)}`,
          );
        }

        emitFile(filename, code);

        const config = api.getNormalizedConfig();

        const handleErrorSnippet = `throw new Error('Failed to load Node.js addon: "${filename}"', {
    cause: error,
  });`;

        if (config.output.module) {
          // ESM output
          return `
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let native;
try {
  native = require(path.join(__dirname, "${filename}"));
} catch (error) {
  ${handleErrorSnippet}
}

export default native;
`;
        }

        // CJS output
        return `
try {
  const path = __non_webpack_require__("node:path");
  module.exports = __non_webpack_require__(path.join(__dirname, "${filename}"));
} catch (error) {
  ${handleErrorSnippet}
}
`;
      },
    );
  },
});
