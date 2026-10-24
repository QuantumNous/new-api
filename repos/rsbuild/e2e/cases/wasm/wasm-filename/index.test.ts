import { expect, test } from '@e2e/helper';
import { findFile } from '@rstackjs/test-utils';

test('should allow to custom the filename of Wasm files', async ({ buildPreview }) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();

  const wasmFile = findFile(files, 'factorial.wasm');

  expect(wasmFile).toBeTruthy();
});
