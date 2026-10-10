import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { getRandomPort } from '@rstackjs/test-utils';

const fixtures = import.meta.dirname;

test('should access / and htmlFallback success by default', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      output: {
        distPath: 'dist-0',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  const url1 = new URL(`http://localhost:${rsbuild.port}/aaaa`);

  await page.goto(url1.href);

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');
});

test('should return 404 when htmlFallback false', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      server: {
        htmlFallback: false,
      },
      output: {
        distPath: 'dist-0',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/aaaaa`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(404);
});

test('should access /main.html success when entry is main', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: 'dist-1',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main.html`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: 'dist-2',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(200);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main and set assetPrefix', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: 'dist-4',
        assetPrefix: '/aaaa/',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main and outputPath is /main/index.html', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: 'dist-5',
      },
      html: {
        outputStructure: 'nested',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should return 404 when page is not found', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: 'dist-6',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main1`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(404);
});

test('should access /html/main success when entry is main and outputPath is /html/main.html', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          main: join(fixtures, 'src/index.ts'),
        },
      },
      output: {
        distPath: {
          root: 'dist-7',
          html: 'html',
        },
      },
    },
  });

  // access /html/main success
  const url = new URL(`http://localhost:${rsbuild.port}/html/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  // access /main failed
  const url1 = new URL(`http://localhost:${rsbuild.port}/main`);

  const res = await page.goto(url1.href);

  expect(res?.status()).toBe(404);
});

test('should match resource correctly with specify assetPrefix', async ({ page, buildPreview }) => {
  const port = await getRandomPort();

  const rsbuild = await buildPreview({
    config: {
      server: {
        port,
      },
      output: {
        assetPrefix: '/subpath/',
        distPath: 'dist-8',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should match resource correctly with full url assetPrefix', async ({
  page,
  buildPreview,
}) => {
  const port = await getRandomPort();

  const rsbuild = await buildPreview({
    config: {
      server: {
        port,
      },
      output: {
        assetPrefix: `http://localhost:${port}/subpath/`,
        distPath: 'dist-8',
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});
