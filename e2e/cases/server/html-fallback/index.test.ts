import { expect, getFileContent, test } from '@e2e/helper';

test('should access / success and htmlFallback success by default', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  const url = new URL(`http://localhost:${rsbuild.port}/`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  // should fallback to index by default
  const url1 = new URL(`http://localhost:${rsbuild.port}/aaaaa`);

  await page.goto(url1.href);

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');

  // compat invalid route and fallback success
  await page.goto(`http://localhost:${rsbuild.port}//aaaaa`);

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');
});

test('should return 404 when htmlFallback false', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        htmlFallback: false,
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/aaaaa`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(404);
});

test('should access /main with query or hash success', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main?aa=1`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(200);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  const url1 = new URL(`http://localhost:${rsbuild.port}/main#aa=1`);

  const res1 = await page.goto(url1.href);

  expect(res1?.status()).toBe(200);
});

test('should access /main.html success when entry is main', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main.html`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(200);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main and use memoryFs', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});

test('should access /main success when entry is main and set assetPrefix', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
      dev: {
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
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
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

test('should return 404 when page is not found', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main1`);

  const res = await page.goto(url.href);

  expect(res?.status()).toBe(404);
});

test('should access /html/main success when entry is main and outputPath is /html/main.html', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
      output: {
        distPath: {
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

test('should access /main success when modify publicPath in compiler', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
      plugins: [
        {
          name: 'foo',
          setup(api: any) {
            api.modifyBundlerChain((chain: any) => {
              chain.output.publicPath('/aaaa/');
            });
          },
        },
      ],
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  const files = rsbuild.getDistFiles();
  const htmlContent = getFileContent(files, 'main.html');

  expect(htmlContent.includes('/aaaa/static/js/main.js')).toBeTruthy();
});

test('should access /main success when distPath is absolute', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          main: './src/index.js',
        },
      },
    },
  });

  // access /main success
  const url = new URL(`http://localhost:${rsbuild.port}/main`);

  await page.goto(url.href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});
