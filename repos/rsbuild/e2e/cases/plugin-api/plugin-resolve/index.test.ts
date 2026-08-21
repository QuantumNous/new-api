import { expect, test } from '@e2e/helper';

test('should allow plugin to custom resolver', async ({ build }) => {
  await expect(build()).resolves.toBeDefined();
});
