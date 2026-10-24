import { test, expect } from '@playwright/test';

test('createStreamableValue and readStreamableValue', async ({ page }) => {
  await page.goto('/rsc');
  await page.click('#test-streamable-value');

  const logs = page.locator('#log');
  await expect(logs).toHaveText(
    '["hello","hello, world","hello, world!",{"value":"I am a JSON"},["Finished"]]',
  );
});

test('test-streamable-ui', async ({ page }) => {
  await page.goto('/rsc');
  await page.click('#test-streamable-ui');

  const logs = page.locator('#log');
  await expect(logs).toHaveText('I am a button');
});
