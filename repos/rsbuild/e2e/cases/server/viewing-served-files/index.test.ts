import { expect, test } from '@e2e/helper';

test('should show assets on /rsbuild-dev-server path', async ({ page, dev }) => {
  const rsbuild = await dev();

  await page.goto(`http://localhost:${rsbuild.port}/rsbuild-dev-server`);

  await page.waitForSelector('h1', { state: 'attached' });
  await page.waitForSelector('ul', { state: 'attached' });

  const titles = await page.$$eval('h1', (nodes) => nodes.map((n) => n.textContent));
  expect(titles.includes('Assets Report')).toBe(true);

  // check all href are valid
  const hrefList = await page.$$eval('ul li a', (nodes) => nodes.map((node) => node?.textContent));
  for (const href of hrefList) {
    const status = await page.evaluate(async (url) => {
      const response = await fetch(url as string);
      return response.status;
    }, href);

    expect(status).toBeGreaterThanOrEqual(200);
  }
});

test('should show assets on /rsbuild-dev-server path with server.base and assetPrefix', async ({
  page,
  dev,
}) => {
  const rsbuild = await dev({
    config: {
      dev: {
        assetPrefix: '/testing/assets/',
      },
      server: {
        base: '/testing',
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}/testing/rsbuild-dev-server`);
  await page.waitForSelector('h1', { state: 'attached' });
  await page.waitForSelector('ul', { state: 'attached' });
  const titles = await page.$$eval('h1', (nodes) => nodes.map((n) => n.textContent));
  expect(titles.includes('Assets Report')).toBe(true);

  // check all href are valid
  const hrefList = await page.$$eval('ul li a', (nodes) => nodes.map((node) => node?.textContent));
  for (const href of hrefList) {
    const status = await page.evaluate(async (url) => {
      const response = await fetch(url as string);
      return response.status;
    }, href);

    expect(status).toBeGreaterThanOrEqual(200);
  }
});

test('should show assets on /rsbuild-dev-server path with environments', async ({ page, dev }) => {
  const entry1 = './src/index.tsx';
  const entry2 = './src2/index.tsx';

  const rsbuild = await dev({
    config: {
      environments: {
        test1: {
          source: {
            entry: {
              index: entry1,
            },
          },
        },
        test2: {
          source: {
            entry: {
              index: entry2,
            },
          },
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}/rsbuild-dev-server`);
  await page.waitForSelector('h1', { state: 'attached' });
  await page.waitForSelector('ul', { state: 'attached' });
  const titles = await page.$$eval('h1', (nodes) => nodes.map((n) => n.textContent));
  const subTitles = await page.$$eval('h2', (nodes) => nodes.map((n) => n.textContent));
  expect(titles.includes('Assets Report')).toBe(true);
  expect(subTitles.includes('Environment: test1')).toBe(true);
  expect(subTitles.includes('Environment: test2')).toBe(true);

  // check all href are valid
  const hrefList = await page.$$eval('ul li a', (nodes) => nodes.map((node) => node?.textContent));
  for (const href of hrefList) {
    const status = await page.evaluate(async (url) => {
      const response = await fetch(url as string);
      return response.status;
    }, href);

    expect(status).toBeGreaterThanOrEqual(200);
  }
});
