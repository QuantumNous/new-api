import path from 'node:path';
import { expect, test } from '@e2e/helper';

function isIncludeFile(filenames: string[], includeFilename: string) {
  return filenames.some((filename) => filename.includes(includeFilename));
}

test('should support configuring additional assets matched by RegExp', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        assetsInclude: [/\.json5$/],
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  const indexJs = await rsbuild.getIndexBundle();
  expect(indexJs).toContain('data:application/json5;base64,');

  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-large.json5')).toBeTruthy();
  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-small.json5')).toBeFalsy();
});

test('should support configuring additional assets matched by path', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        assetsInclude: path.resolve(import.meta.dirname, 'src/assets'),
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  const indexJs = await rsbuild.getIndexBundle();
  expect(indexJs).toContain('data:application/json5;base64,');

  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-large.json5')).toBeTruthy();
  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-small.json5')).toBeFalsy();
});

test('should support disabling emission for additional assets', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        assetsInclude: [/\.json5$/],
      },
      output: {
        emitAssets: false,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-large.json5')).toBeFalsy();
  expect(isIncludeFile(filenames, 'dist/static/assets/test-temp-small.json5')).toBeFalsy();
});
