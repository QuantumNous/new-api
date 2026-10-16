import { expect, test } from '@e2e/helper';
import { findFile } from '@rstackjs/test-utils';

test('should allow to import a Wasm module with source phase import', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();

  const wasmFile = findFile(files, '.module.wasm');

  expect(wasmFile).toBeTruthy();
  expect(/static[\\/]wasm/g.test(wasmFile)).toBeTruthy();

  await page.waitForFunction(() => {
    return Boolean(document.querySelector('#root')?.innerHTML);
  });

  await expect(page.locator('#root')).toHaveText('true,6');
});
