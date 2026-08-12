import { expect, findFile, test } from '@e2e/helper';

test('should process assets when target is web', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  expect(() => findFile(files, 'index.js')).toThrow();
});

test('should not process assets when target is not web', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web-worker',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const indexJs = findFile(files, 'index.js');
  expect(indexJs).toBeTruthy();
});
