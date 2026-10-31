import { expect, test } from '@e2e/helper';

test('should start MF app in dev without entry', async ({ devOnly }) => {
  await expect(devOnly()).resolves.toBeTruthy();
});

test('should build MF app without entry', async ({ build }) => {
  await expect(build()).resolves.toBeTruthy();
});
