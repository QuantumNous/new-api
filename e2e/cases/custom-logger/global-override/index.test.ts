import { expect, test } from '@e2e/helper';

test('should allow to override global logger', async ({ build }) => {
  const rsbuild = await build();
  expect(rsbuild.logs.find((item) => item.includes('[TEST] hello world'))).toBeTruthy();
});
