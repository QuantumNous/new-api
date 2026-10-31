import { expect, test } from '@e2e/helper';

test('should support ignoreEsComponent and ignoreStyleComponent', async ({
  build,
  copyNodeModules,
}) => {
  await copyNodeModules();

  const rsbuild = await build({
    config: {
      source: {
        transformImport: [
          {
            libraryName: 'foo',
            libraryDirectory: 'lib',
            style: true,
            ignoreEsComponent: ['IgnoredScript'],
            ignoreStyleComponent: ['IgnoredStyle'],
          },
        ],
      },
      splitChunks: false,
    },
  });
  const content = await rsbuild.getIndexBundle();

  expect(content).toContain('ignoreEsComponent test succeed');
  expect(content).toContain('transformImport button component succeed');
  expect(content).toContain('transformImport button style succeed');
  expect(content).toContain('ignoreStyleComponent JS import succeed');
  expect(content).not.toContain('ignoreStyleComponent style import should not be bundled');
});
