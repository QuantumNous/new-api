import { expect, test } from '@e2e/helper';

test('should load bundle with natural chunk ids', async ({ devOnly, request }) => {
  const rsbuild = await devOnly();
  const baseUrl = `http://localhost:${rsbuild.port}`;

  const response = await request.get(`${baseUrl}/check`);

  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('load-bundle-natural-chunk-ids');
});
