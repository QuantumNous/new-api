import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile CSS Modules composes correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toMatch(/.*\{color:#ff0;background:red\}.*\{background:#00f\}/);
});

test('should compile CSS Modules composes with external correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          external: './src/external.js',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'external.css');
  expect(content).toMatch(/.*\{color:#000;background:#0ff\}.*\{background:green\}/);
});
