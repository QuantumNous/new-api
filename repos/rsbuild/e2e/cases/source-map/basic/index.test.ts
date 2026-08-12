import { readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import {
  type Build,
  expect,
  findFile,
  getFileContent,
  mapSourceMapPositions,
  test,
} from '@e2e/helper';
import type { Rspack } from '@rsbuild/core';

const cwd = import.meta.dirname;

async function testSourceMapType(devtool: Rspack.Configuration['devtool'], build: Build) {
  const rsbuild = await build({
    config: {
      output: {
        sourceMap: {
          js: devtool,
        },
        legalComments: 'none',
        filenameHash: false,
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const indexSourceCode = readFileSync(path.join(import.meta.dirname, 'src/index.js'), 'utf-8');
  const appSourceCode = readFileSync(path.join(import.meta.dirname, 'src/App.jsx'), 'utf-8');
  const outputCode = getFileContent(files, 'index.js');
  const sourceMap = getFileContent(files, 'index.js.map');

  const AppContentIndex = outputCode.indexOf('Hello Rsbuild!');
  const indexContentIndex = outputCode.indexOf('window.test');

  const positions = await mapSourceMapPositions(sourceMap, [
    {
      line: 1,
      column: AppContentIndex,
    },
    {
      line: 1,
      column: indexContentIndex,
    },
  ]);

  expect(positions).toEqual([
    {
      source: '../../../src/App.jsx',
      line: 2,
      column: appSourceCode.split('\n')[1].indexOf('Hello Rsbuild!'),
      name: null,
    },
    {
      source: '../../../src/index.js',
      line: 7,
      column: indexSourceCode.split('\n')[6].indexOf('window'),
      name: 'window',
    },
  ]);
}

const productionDevtools: Rspack.Configuration['devtool'][] = [
  'source-map',
  'nosources-source-map',
  'hidden-nosources-source-map',
  'hidden-source-map',
];

for (const devtool of productionDevtools) {
  test(`should generate correct "${devtool}" source map in build`, async ({ build }) => {
    await testSourceMapType(devtool, build);
  });
}

test('should not generate source map by default in build', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const jsMapPaths = Object.keys(files).filter((files) => files.endsWith('.js.map'));
  const cssMapFiles = Object.keys(files).filter((files) => files.endsWith('.css.map'));
  expect(jsMapPaths.length).toEqual(0);
  expect(cssMapFiles.length).toEqual(0);
});

test('should generate source map if `output.sourceMap` is true', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        sourceMap: true,
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const jsMapPaths = Object.keys(files).filter((files) => files.endsWith('.js.map'));
  const cssMapFiles = Object.keys(files).filter((files) => files.endsWith('.css.map'));
  expect(jsMapPaths.length).toBeGreaterThan(0);
  expect(cssMapFiles.length).toBeGreaterThan(0);
});

test('should not generate source map if `output.sourceMap` is false', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        sourceMap: false,
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const jsMapPaths = Object.keys(files).filter((files) => files.endsWith('.js.map'));
  const cssMapFiles = Object.keys(files).filter((files) => files.endsWith('.css.map'));
  expect(jsMapPaths.length).toEqual(0);
  expect(cssMapFiles.length).toEqual(0);
});

test('should generate source map correctly in dev', async ({ dev }) => {
  const rsbuild = await dev();
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const jsMap = JSON.parse(getFileContent(files, '.js.map'));
  expect(jsMap.sources.length).toBeGreaterThan(1);
  expect(jsMap.file).toEqual('static/js/index.js');
  expect(jsMap.sourcesContent).toContain(readFileSync(join(cwd, 'src/App.jsx'), 'utf-8'));
  expect(jsMap.sourcesContent).toContain(readFileSync(join(cwd, 'src/index.js'), 'utf-8'));
  expect(jsMap.mappings).not.toBeUndefined();
});

test('should generate source maps only for CSS files', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        filenameHash: false,
        sourceMap: {
          js: false,
          css: true,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const jsMapPaths = Object.keys(files).filter((files) => files.endsWith('.js.map'));
  const cssMapFiles = Object.keys(files).filter((files) => files.endsWith('.css.map'));
  expect(jsMapPaths.length).toEqual(0);
  expect(cssMapFiles.length).toBeGreaterThan(0);

  const cssSourceMap = findFile(files, 'index.css.map');
  const cssSourceContent = readFileSync(join(cwd, './src/index.css'), 'utf-8');

  expect(JSON.parse(files[cssSourceMap])).toEqual({
    file: 'static/css/index.css',
    mappings: 'AAAA',
    names: [],
    sources: ['../../../src/index.css'],
    sourcesContent: [cssSourceContent],
    version: 3,
  });
});
