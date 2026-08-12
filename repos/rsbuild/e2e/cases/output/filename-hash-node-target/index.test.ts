import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to force filename hash for node target', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        filenameHash: {
          enable: 'always',
          format: 'contenthash:8',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);
  expect(filenames.some((key) => /\/index\.js$/.test(key))).toBeFalsy();

  const indexJs = getFileContent(files, (key) => /\/index\.\w{8}\.js$/.test(key), {
    ignoreHash: false,
  });

  expect(indexJs).toContain('filename hash for node target');
});
