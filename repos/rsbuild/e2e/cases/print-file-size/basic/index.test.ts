import { expect, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';
import { extractFileSizeLogs } from '../helper';

test('should print file size after building by default', async ({ build }) => {
  const rsbuild = await build();

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/css/index.[[hash]].css     X.X kB    X.X kB
dist/index.html                        X.X kB    X.X kB
dist/static/js/index.[[hash]].js       X.X kB     X.X kB
dist/static/image/icon.[[hash]].png    X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB
                              Total:   X.X kB   X.X kB`);
});

test('should print size of multiple environments correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        filenameHash: false,
      },
      environments: {
        web: {},
        node: {
          output: {
            target: 'node',
            distPath: 'dist/server',
          },
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                    Size       Gzip
dist/static/css/index.css     X.X kB    X.X kB
dist/index.html               X.X kB    X.X kB
dist/static/js/index.js       X.X kB     X.X kB
dist/static/image/icon.png    X.X kB
dist/static/js/lib-react.js   X.X kB   X.X kB
                     Total:   X.X kB   X.X kB
File (node)                         Size
dist/server/static/image/icon.png   X.X kB
dist/server/index.js                X.X kB
                           Total:   X.X kB`);
});

test('should not print logs when printFileSize is false', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: false,
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual('');
});

test('should not print details when printFileSize.detail is false', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          detail: false,
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
Total size (web): X.X kB (X.X kB gzipped)`);
});

test('printFileSize.total: false should work', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          total: false,
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/css/index.[[hash]].css     X.X kB    X.X kB
dist/index.html                        X.X kB    X.X kB
dist/static/js/index.[[hash]].js       X.X kB     X.X kB
dist/static/image/icon.[[hash]].png    X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB`);
});

test('should print dist folder correctly if it is not a subdir of root', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        distPath: '../test-temp-folder/dist',
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                                                 Size       Gzip
../test-temp-folder/dist/static/css/index.[[hash]].css     X.X kB    X.X kB
../test-temp-folder/dist/index.html                        X.X kB    X.X kB
../test-temp-folder/dist/static/js/index.[[hash]].js       X.X kB     X.X kB
../test-temp-folder/dist/static/image/icon.[[hash]].png    X.X kB
../test-temp-folder/dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB
                                                  Total:   X.X kB   X.X kB`);
});

test('should allow to disable gzip-compressed size', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          compressed: false,
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size
dist/static/css/index.[[hash]].css     X.X kB
dist/index.html                        X.X kB
dist/static/js/index.[[hash]].js       X.X kB
dist/static/image/icon.[[hash]].png    X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB
                              Total:   X.X kB`);
});

test('should allow to filter assets by name', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          include: (asset) => asset.name.endsWith('.js'),
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/js/index.[[hash]].js       X.X kB     X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB
                              Total:   X.X kB   X.X kB`);
});

test('should allow to filter assets by size', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          include: (asset) => asset.size > 10 * 1000,
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB`);
});

test('should allow to custom exclude function', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          exclude: (asset) =>
            /\.(?:map|LICENSE\.txt)$/.test(asset.name) || /\.html$/.test(asset.name),
        },
      },
    },
  });

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/css/index.[[hash]].css     X.X kB    X.X kB
dist/static/js/index.[[hash]].js       X.X kB     X.X kB
dist/static/image/icon.[[hash]].png    X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB
                              Total:   X.X kB   X.X kB`);
});

test('should not calculate gzip size if the asset is not compressible', async ({ build }) => {
  const rsbuild = await build();

  expect(extractFileSizeLogs(rsbuild.logs)).toEqual(`
File (web)                             Size       Gzip
dist/static/css/index.[[hash]].css     X.X kB    X.X kB
dist/index.html                        X.X kB    X.X kB
dist/static/js/index.[[hash]].js       X.X kB     X.X kB
dist/static/image/icon.[[hash]].png    X.X kB
dist/static/js/lib-react.[[hash]].js   X.X kB   X.X kB
                              Total:   X.X kB   X.X kB`);
});

test('should calculate gzip size for script-like assets', async ({ build }) => {
  const emitTsAssetPlugin: RsbuildPlugin = {
    name: 'emit-ts-asset',
    setup(api) {
      api.processAssets({ stage: 'additional' }, ({ compilation, sources }) => {
        compilation.emitAsset(
          'static/assets/script.ts',
          new sources.RawSource("const value = 'ts';\n"),
        );
      });
    },
  };

  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          total: false,
        },
      },
      plugins: [emitTsAssetPlugin],
    },
  });

  const logs = extractFileSizeLogs(rsbuild.logs);

  expect(logs).toMatch(/dist\/static\/assets\/script\.ts\s+X\.X kB\s+X\.X kB/);
});

test('should respect a custom total function for printFileSize', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        printFileSize: {
          total: ({ assets }) => {
            return `Generated ${assets.length} files.`;
          },
          detail: false,
        },
      },
    },
  });

  await rsbuild.expectLog('Generated 5 files.');
});
