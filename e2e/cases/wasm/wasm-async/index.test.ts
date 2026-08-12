import { expect, test } from '@e2e/helper';
import { findFile } from '@rstackjs/test-utils';

test('should allow to dynamic import a Wasm file', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const wasmFile = findFile(files, '.module.wasm');

  expect(wasmFile).toBeTruthy();
  expect(/static[\\/]wasm/g.test(wasmFile)).toBeTruthy();
});
