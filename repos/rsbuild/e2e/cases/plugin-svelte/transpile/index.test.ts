import { expect, test } from '@e2e/helper';

test('should transpile .svelte files to ES2015 as expected', async ({ build }) => {
  expect(build()).resolves.toBeTruthy();
});
