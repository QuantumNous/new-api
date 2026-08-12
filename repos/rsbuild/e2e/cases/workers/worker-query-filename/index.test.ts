import { expect, test } from '@e2e/helper';

test('should respect custom JS output filename for worker query imports', async ({ build }) => {
  const result = await build();

  const files = result.getDistFiles();
  const jsFiles = Object.keys(files)
    .filter((filename) => filename.endsWith('.js'))
    .sort();

  expect(jsFiles).toHaveLength(2);
  expect(jsFiles[0]).toMatch(/\/assets\/async\/.+\.bundle\.js$/);
  expect(jsFiles[1]).toMatch(/\/assets\/js\/index\.bundle\.js$/);
  expect(files[jsFiles[0]]).toContain('worker-filename-marker');
});
