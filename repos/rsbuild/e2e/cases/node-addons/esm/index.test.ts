import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { findFile } from '@rstackjs/test-utils';
import fse from 'fs-extra';

test('should compile Node addons correctly for ESM output', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const addonFile = findFile(files, 'test.darwin.node');
  expect(fs.existsSync(addonFile)).toBeTruthy();

  // the `test.darwin.node` is only compatible with darwin
  if (process.platform === 'darwin') {
    const { addon } = await import('./dist/index.js' as string);
    expect(typeof addon.readLength).toEqual('function');
  }
});

test('should compile Node addons in the node_modules for ESM output', async ({ build }) => {
  const pkgDir = join(import.meta.dirname, 'node_modules', 'node-addon-pkg');

  await fse.remove(pkgDir);

  fse.outputJSONSync(join(pkgDir, 'package.json'), {
    name: 'node-addon-pkg',
    main: 'src/index.js',
  });
  fse.outputFileSync(
    join(pkgDir, 'src', 'index.js'),
    `import addon from './other.node'; export default addon;`,
  );
  fse.ensureDirSync(join(pkgDir, 'src'));
  fs.copyFileSync(
    join(import.meta.dirname, 'src', 'test.darwin.node'),
    join(pkgDir, 'src', 'other.node'),
  );

  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/other.js',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const addonFile = findFile(files, 'other.node');
  expect(fs.existsSync(addonFile)).toBeTruthy();

  if (process.platform === 'darwin') {
    const { addon } = await import('./dist/index.js' as string);
    expect(typeof addon.readLength).toEqual('function');
  }
});
