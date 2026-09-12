import { expect, test } from '@e2e/helper';

test('should handle proxy error', async ({ dev, page }) => {
  const rsbuild = await dev();

  const res = await page.goto(`http://localhost:${rsbuild.port}/api`);
  expect(res?.status()).toBe(504);
  const body = await res?.text();
  expect(body).toContain('Error occurred while trying to proxy');
});
