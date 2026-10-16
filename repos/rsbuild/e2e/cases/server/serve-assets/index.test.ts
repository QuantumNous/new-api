import { expect, test } from '@e2e/helper';

test('should serve static files', async ({ request, dev }) => {
  const rsbuild = await dev();
  const baseUrl = `http://localhost:${rsbuild.port}`;
  const resText = await request.get(`${baseUrl}/foo.txt`);
  expect(await resText.text()).toContain('bar');
  const resIndexJs = await request.get(`${baseUrl}/static/js/index.js`);
  expect(await resIndexJs.text()).toContain('Hello Rsbuild!');
});

test('should return 403 for path traversal', async ({ request, dev }) => {
  const rsbuild = await dev();
  const baseUrl = `http://localhost:${rsbuild.port}`;
  const res = await request.get(`${baseUrl}/..%2f../foo.txt`);
  expect(res.status()).toEqual(403);
  expect(await res.text()).toContain('Forbidden');
  await rsbuild.expectLog('Malicious path');
});

test('should return 400 for null byte injection', async ({ request, dev }) => {
  const rsbuild = await dev();
  const baseUrl = `http://localhost:${rsbuild.port}`;
  const res = await request.get(`${baseUrl}/foo%00bar.js`);
  expect(res.status()).toEqual(400);
  expect(await res.text()).toContain('Bad Request');
  await rsbuild.expectLog('Invalid pathname');
});

test('should return 400 for invalid pathname', async ({ request, dev }) => {
  const rsbuild = await dev();
  const baseUrl = `http://localhost:${rsbuild.port}`;
  const res = await request.get(`${baseUrl}/foo%E0%A4bar.js`);
  expect(res.status()).toEqual(400);
  expect(await res.text()).toContain('Bad Request');
  await rsbuild.expectLog('Invalid pathname');
});
