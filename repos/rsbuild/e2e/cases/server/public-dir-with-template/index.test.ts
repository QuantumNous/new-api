import { expect, test } from '@e2e/helper';

test('should serve publicDir with template for dev server correctly', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  const res = await page.goto(`http://localhost:${rsbuild.port}/aa.txt`);
  expect((await res?.body())?.toString().trim()).toBe('aaaa');

  await page.goto(`http://localhost:${rsbuild.port}`);
  const title = await page.$('title');
  expect(await title?.innerText()).toBe('Hello');
});

test('should serve publicDir with template for preview server correctly', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const res = await page.goto(`http://localhost:${rsbuild.port}/aa.txt`);
  expect((await res?.body())?.toString().trim()).toBe('aaaa');

  await page.goto(`http://localhost:${rsbuild.port}`);
  const title = await page.$('title');
  expect(await title?.innerText()).toBe('Hello');
});
