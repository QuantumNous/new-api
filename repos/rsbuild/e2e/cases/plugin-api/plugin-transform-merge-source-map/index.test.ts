import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, mapSourceMapPositions, test } from '@e2e/helper';
import { getDistFiles, getFileContent } from '@rstackjs/test-utils';

const expectSourceMap = async (files: Record<string, string>) => {
  const sourceCode = readFileSync(path.join(import.meta.dirname, 'src/index.ts'), 'utf-8');
  const outputCode = getFileContent(files, 'index.js');
  const sourceMap = getFileContent(files, 'index.js.map');

  const argsPosition = outputCode.indexOf('"args"');
  const helloPosition = outputCode.indexOf('"hello"');

  const positions = await mapSourceMapPositions(sourceMap, [
    {
      line: 1,
      column: argsPosition,
    },
    {
      line: 1,
      column: helloPosition,
    },
  ]);

  const sourceLines = sourceCode.split('\n');
  expect(positions).toEqual([
    {
      source: '../../../src/index.ts',
      line: 2,
      column: sourceLines[1].indexOf(`'args'`),
      name: null,
    },
    {
      source: '../../../src/index.ts',
      line: 5,
      column: sourceLines[4].indexOf(`'hello'`),
      name: null,
    },
  ]);
};

test('should merge source map when plugin transforms code in build', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  await expectSourceMap(files);
});

test('should merge source map when plugin transforms code in dev', async ({ dev }) => {
  const rsbuild = await dev();
  const files = await getDistFiles(rsbuild.distPath, true);

  await expectSourceMap(files);
});
