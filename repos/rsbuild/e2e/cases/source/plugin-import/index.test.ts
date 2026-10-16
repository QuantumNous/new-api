import { expect, test } from '@e2e/helper';
import { cases, findEntry, shareTest } from './helper';

test('should import with template config', async ({ build, copyNodeModules }) => {
  await copyNodeModules();

  const rsbuild = await build({
    config: {
      source: {
        transformImport: [
          {
            libraryName: 'foo',
            customName: 'foo/lib/{{ member }}',
          },
        ],
      },
      splitChunks: false,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const entry = findEntry(files);
  expect(files[entry]).toContain('transformImport test succeed');
});

test('should not transformImport by default', async ({ build, copyNodeModules }) => {
  await copyNodeModules();

  const rsbuild = await build({
    config: {
      splitChunks: false,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const entry = findEntry(files);
  expect(files[entry]).toContain('test succeed');
});

for (const c of cases) {
  const [name, entry, config] = c;
  shareTest(`${name}-rspack`, entry, config);
}
