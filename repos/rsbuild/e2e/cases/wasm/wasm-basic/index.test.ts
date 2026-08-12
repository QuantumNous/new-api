import { expect, findFile, test } from '@e2e/helper';

test('should allow to import a Wasm file', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();

  const wasmFile = findFile(files, '.module.wasm');

  expect(wasmFile).toBeTruthy();
  expect(/static[\\/]wasm/g.test(wasmFile)).toBeTruthy();

  await page.waitForFunction(() => {
    return Boolean(document.querySelector('#root')?.innerHTML);
  });

  const locator = page.locator('#root');
  await expect(locator).toHaveText('6');
});
