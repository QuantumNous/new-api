import { expect, findFile, test } from '@e2e/helper';

test('should allow to use new URL to get path of a Wasm file', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();

  const wasmFile = findFile(files, '.module.wasm');

  expect(wasmFile).toBeTruthy();
  expect(/static[\\/]wasm/g.test(wasmFile)).toBeTruthy();

  await page.waitForFunction(() => {
    return Boolean(document.querySelector('#root')?.innerHTML);
  });

  await expect(page.evaluate(`document.querySelector('#root').innerHTML`)).resolves.toMatch(
    /\/static\/wasm\/\w+\.module\.wasm/,
  );
});
