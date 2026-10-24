import { expect, gotoPage, test } from '@e2e/helper';
import { createRsbuild } from '@rsbuild/core';

test('should allow to call `sockWrite` after creating dev server', async ({ page }) => {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });

  const server = await rsbuild.createDevServer();

  await server.listen();
  await gotoPage(page, server);
  const button = page.locator('#button');
  await expect(button).toHaveText('count: 0');

  await button.click();
  await expect(button).toHaveText('count: 1');
  let loadPromise = page.waitForEvent('load');
  server.sockWrite('full-reload');
  await loadPromise;
  await expect(button).toHaveText('count: 0');

  await button.click();
  await expect(button).toHaveText('count: 1');
  loadPromise = page.waitForEvent('load');
  server.sockWrite('static-changed');
  await loadPromise;
  await expect(button).toHaveText('count: 0');

  await button.click();
  await expect(button).toHaveText('count: 1');
  loadPromise = page.waitForEvent('load');
  server.sockWrite('full-reload', {
    path: '*',
  });
  await loadPromise;
  await expect(button).toHaveText('count: 0');

  await server.close();
});

test('should only reload the matching html page when path is provided', async ({ page }) => {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      server: {
        base: '/base',
      },
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
    },
  });

  const server = await rsbuild.createDevServer();

  await server.listen();

  const page2 = await page.context().newPage();
  await page.goto(`http://localhost:${server.port}/base/index.html`);
  await page2.goto(`http://localhost:${server.port}/base/foo.html`);

  const button = page.locator('#button');
  await expect(button).toHaveText('count: 0');
  await button.click();
  await expect(button).toHaveText('count: 1');
  await expect(page2.locator('#title')).toHaveText('foo');

  const fooLoadPromise = page2.waitForEvent('load');
  server.sockWrite('full-reload', {
    path: '/foo.html',
  });
  await fooLoadPromise;

  await expect(button).toHaveText('count: 1');
  await expect(page2.locator('#title')).toHaveText('foo');

  await page2.close();
  await server.close();
});

test('should reload html routes without .html extension when html path is provided', async ({
  page,
}) => {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      server: {
        base: '/base',
      },
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
    },
  });

  const server = await rsbuild.createDevServer();

  await server.listen();

  const page2 = await page.context().newPage();
  await page.goto(`http://localhost:${server.port}/base/index.html`);
  await page2.goto(`http://localhost:${server.port}/base/foo`);

  const button = page.locator('#button');
  await expect(button).toHaveText('count: 0');
  await button.click();
  await expect(button).toHaveText('count: 1');
  await expect(page2.locator('#title')).toHaveText('foo');

  const fooLoadPromise = page2.waitForEvent('load');
  server.sockWrite('full-reload', {
    path: '/foo.html',
  });
  await fooLoadPromise;

  await expect(button).toHaveText('count: 1');
  await expect(page2.locator('#title')).toHaveText('foo');
  expect(page2.url()).toBe(`http://localhost:${server.port}/base/foo`);

  await page2.close();
  await server.close();
});
