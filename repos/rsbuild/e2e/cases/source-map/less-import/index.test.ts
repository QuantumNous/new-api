import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, findFile, mapSourceMapPositions, normalizeNewlines, test } from '@e2e/helper';

const normalizePath = (source: string | null) => source?.replace(/\\/g, '/') ?? '';

const isImportedLess = (source: string | null) =>
  /(^|\/)src\/imported\.less$/.test(normalizePath(source));

const getGeneratedPosition = (code: string, pattern: RegExp) => {
  const match = pattern.exec(code);
  expect(match).not.toBeNull();

  const beforeMatch = code.slice(0, match!.index).split('\n');

  return {
    line: beforeMatch.length,
    column: beforeMatch[beforeMatch.length - 1].length,
  };
};

test('should map imported Less sources correctly in CSS source map', async ({ devOnly }) => {
  const rsbuild = await devOnly();
  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const css = files[findFile(files, 'index.css')];
  const cssMap = files[findFile(files, 'index.css.map')];

  const [originalPosition] = await mapSourceMapPositions(cssMap, [
    getGeneratedPosition(css, /\.imported-panel/),
  ]);

  const importedSource = readFileSync(join(import.meta.dirname, 'src/imported.less'), 'utf-8');
  const sourceMap = JSON.parse(cssMap) as {
    sources: string[];
    sourcesContent: string[];
  };
  const importedSourceIndex = sourceMap.sources.findIndex((source) => isImportedLess(source));

  expect(isImportedLess(originalPosition.source)).toBe(true);
  expect(originalPosition.line).toBe(1);
  expect(originalPosition.column).toBe(importedSource.split('\n')[0].indexOf('.imported-panel'));
  expect(importedSourceIndex).toBeGreaterThanOrEqual(0);
  expect(normalizeNewlines(sourceMap.sourcesContent[importedSourceIndex])).toBe(
    normalizeNewlines(importedSource),
  );
});
