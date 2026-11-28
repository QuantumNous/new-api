import { expect, test } from '@e2e/helper';

test('should load CJS bundle with runtime globals', async ({ devOnly, request }) => {
  const rsbuild = await devOnly();
  const baseUrl = `http://localhost:${rsbuild.port}`;

  const response1 = await request.get(`${baseUrl}/check`);
  const response2 = await request.get(`${baseUrl}/check`);

  expect(response1.status()).toBe(200);
  expect(await response1.text()).toBe('index.js:function');
  expect(await response2.text()).toBe('index.js:function');

  expect(rsbuild.logs.filter((log) => log.includes('load bundle cjs')).length).toBe(1);
});
