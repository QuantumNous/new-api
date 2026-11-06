import fs from 'node:fs';
import { join } from 'node:path';
import type { Config } from 'prebundle';

function replaceFileContent(filePath: string, replaceFn: (content: string) => string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = replaceFn(content);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
  }
}

export default {
  prettier: true,
  externals: {
    '@rspack/core': '@rspack/core',
    typescript: 'typescript',
  },
  dependencies: [
    'html-rspack-plugin',
    {
      name: '@rstackjs/load-config',
      dtsOnly: true,
    },
    {
      name: 'chokidar',
      dtsOnly: true,
    },
    {
      name: 'cors',
      dtsOnly: true,
    },
    {
      name: 'connect-next',
      dtsOnly: true,
    },
    {
      name: 'rspack-manifest-plugin',
      dtsOnly: true,
    },
    {
      name: 'rslog',
      dtsOnly: true,
    },
    {
      name: 'rspack-chain',
      copyDts: true,
      dtsOnly: true,
    },
    {
      name: 'http-proxy-middleware',
      dtsOnly: true,
    },
    {
      name: 'style-loader',
      ignoreDts: true,
      afterBundle: (task) => {
        fs.cpSync(join(task.depPath, 'dist/runtime'), join(task.distPath, 'runtime'), {
          recursive: true,
        });
      },
    },
    {
      name: 'postcss',
      copyDts: true,
      minify: true,
      afterBundle(task) {
        // source-map-js type does not exist, use a stub instead
        replaceFileContent(join(task.distPath, 'lib/postcss.d.ts'), (content) =>
          content.replace("from 'source-map-js'", 'from "./source-map-js"'),
        );
        replaceFileContent(join(task.distPath, 'lib/previous-map.d.ts'), (content) =>
          content.replace("from 'source-map-js'", 'from "./source-map-js"'),
        );
        fs.writeFileSync(
          join(task.distPath, 'lib/source-map-js.d.ts'),
          `
export type RawSourceMap = unknown;
export type SourceMapConsumer = unknown;
export type SourceMapGenerator = unknown;
`,
        );
      },
    },
    {
      name: 'css-loader',
      ignoreDts: true,
      minify: true,
      externals: {
        postcss: '../postcss/index.js',
      },
    },
    {
      name: 'postcss-loader',
      externals: {
        jiti: '../jiti',
        postcss: '../postcss/index.js',
      },
      ignoreDts: true,
    },
  ],
} satisfies Config;
