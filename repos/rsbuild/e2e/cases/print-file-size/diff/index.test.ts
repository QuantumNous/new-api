import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import fse from 'fs-extra';
import { extractFileSizeLogs } from '../helper';

test('should print file size diff as expected', async ({ cwd, build, editFile, copySrcDir }) => {
  const cacheDir = join(cwd, 'node_modules/.cache');
  await fse.remove(cacheDir);
  const srcDir = await copySrcDir();
  const config = {
    source: {
      entry: {
        index: join(srcDir, 'index.js'),
      },
    },
  };

  const rsbuild1 = await build({ config });
  expect(extractFileSizeLogs(rsbuild1.logs)).toEqual(`
File (web)                         Size      Gzip
dist/static/js/index.[[hash]].js   X.X kB   X.X kB
dist/index.html                    X.X kB   X.X kB
                          Total:   X.X kB   X.X kB`);
  rsbuild1.clearLogs();

  editFile(
    join(srcDir, 'index.js'),
    () => `import "./App.css";
import React from 'react';
import ReactDOM from 'react-dom';
console.log(React);
console.log(ReactDOM);
`,
  );

  const rsbuild2 = await build({ config });
  expect(extractFileSizeLogs(rsbuild2.logs)).toEqual(`
File (web)                           Size                 Gzip
dist/static/css/index.[[hash]].css   X.X kB (+X.X kB)   X.X kB (+X.X kB)
dist/index.html                      X.X kB (+X.X kB)   X.X kB (+X.X kB)
dist/static/js/index.[[hash]].js     X.X kB (+X.X kB)   X.X kB (+X.X kB)
dist/static/js/vendor.[[hash]].js    X.X kB (+X.X kB)   X.X kB (+X.X kB)
                            Total:   X.X kB (+X.X kB)   X.X kB (+X.X kB)`);
  rsbuild2.clearLogs();

  editFile(join(srcDir, 'index.js'), () => `import "./App.css";`);

  const rsbuild3 = await build({ config });
  expect(extractFileSizeLogs(rsbuild3.logs)).toEqual(`
File (web)                           Size                 Gzip
dist/static/js/index.[[hash]].js     X.X kB (-X.X kB)   X.X kB (-X.X kB)
dist/static/css/index.[[hash]].css   X.X kB              X.X kB
dist/index.html                      X.X kB (-X.X kB)   X.X kB (-X.X kB)
                            Total:   X.X kB (-X.X kB)   X.X kB (-X.X kB)`);
});

test('should not print gzip total diff when change is below threshold', async ({
  cwd,
  build,
  copySrcDir,
}) => {
  const cacheDir = join(cwd, 'node_modules/.cache');
  await fse.remove(cacheDir);
  const srcDir = await copySrcDir();
  const config = {
    source: {
      entry: {
        index: join(srcDir, 'index.js'),
      },
    },
  };

  const rsbuild1 = await build({ config });

  const snapshotDir = join(rsbuild1.instance.context.cachePath, 'rsbuild');
  const snapshotFile = (await fse.readdir(snapshotDir)).find((filename) =>
    filename.startsWith('file-sizes'),
  );
  expect(snapshotFile).toBeTruthy();

  const snapshotPath = join(snapshotDir, snapshotFile!);
  const snapshots = await fse.readJSON(snapshotPath);
  const environmentName = Object.keys(snapshots)[0];

  expect(snapshots[environmentName].totalGzipSize).toBeGreaterThan(5);
  snapshots[environmentName].totalGzipSize -= 5;
  await fse.writeJSON(snapshotPath, snapshots, { spaces: 2 });

  rsbuild1.clearLogs();

  const rsbuild2 = await build({ config });

  expect(extractFileSizeLogs(rsbuild2.logs)).toEqual(`
File (web)                         Size      Gzip
dist/static/js/index.[[hash]].js   X.X kB   X.X kB
dist/index.html                    X.X kB   X.X kB
                          Total:   X.X kB   X.X kB`);
});
