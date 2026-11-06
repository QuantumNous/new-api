import { expect, test } from '@e2e/helper';

test('should allow plugin to specify the execution order via `order`', async ({ build }) => {
  const rsbuild = await build();
  const indexJs = await rsbuild.getIndexBundle();
  expect(indexJs).toContain('with order: pre');
});
