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
  dependencies: [
    {
      name: 'sass-loader',
      externals: {
        sass: 'sass',
        webpack: 'webpack',
      },
      // fix Options type
      afterBundle: (task) => {
        replaceFileContent(
          join(task.distPath, 'index.d.ts'),
          (content) =>
            `${content.replace(
              /export { loader as default };/,
              'export { loader as default, LoaderOptions };',
            )}`,
        );
      },
    },
    {
      name: 'resolve-url-loader',
      ignoreDts: true,
      externals: {
        postcss: 'postcss',
        'loader-utils': 'loader-utils',
      },
    },
  ],
} satisfies Config;
