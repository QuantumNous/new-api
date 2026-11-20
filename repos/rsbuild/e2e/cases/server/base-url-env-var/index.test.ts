import { expect, test } from '@e2e/helper';

test('should define BASE_URL env var correctly', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    // should define `process.env.BASE_URL` correctly
    await expect(page.locator('#public-base-path-process')).toHaveText('/base');

    // should define `import.meta.env.BASE_URL` correctly
    await expect(page.locator('#public-base-path-meta')).toHaveText('/base');
  });
});
