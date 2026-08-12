import { expect, test } from '@e2e/helper';

test('should allow to use `new URL` to reference script as assets', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  const test1 = filenames.find((filename) => filename.includes('dist/static/assets/test1.js'));
  const test2 = filenames.find((filename) => filename.includes('dist/static/assets/test2.ts'));
  const test3 = filenames.find((filename) => filename.includes('dist/static/assets/test3.mjs'));

  expect(test1).toBeDefined();
  expect(test2).toBeDefined();
  expect(test3).toBeDefined();

  expect(files[test1!]).toEqual('export const test="test1";');
  expect(files[test2!]).toContain(`export const test2: string = 'test2';`);
  expect(files[test3!]).toEqual('export const test="test3";');

  expect(await page.evaluate('window.test1')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test1.js`,
  );
  expect(await page.evaluate('window.test2')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test2.ts`,
  );
  expect(await page.evaluate('window.test3')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test3.mjs`,
  );
});
