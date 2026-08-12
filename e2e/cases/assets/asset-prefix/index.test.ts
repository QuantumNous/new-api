import { expect, getFileContent, test } from '@e2e/helper';

test('should allow dev.assetPrefix to be `auto`', async ({ page, dev }) => {
  await dev({
    config: {
      dev: {
        assetPrefix: 'auto',
      },
    },
  });

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText('auto');

  const testEl2 = page.locator('#test2');
  await expect(testEl2).toHaveText('auto');
});

test('should allow dev.assetPrefix to be true', async ({ page, dev }) => {
  const result = await dev({
    config: {
      dev: {
        assetPrefix: true,
      },
    },
  });

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText(`http://localhost:${result.port}`);
});

test('should allow dev.assetPrefix to have <port> placeholder', async ({ page, dev }) => {
  const result = await dev({
    config: {
      dev: {
        assetPrefix: 'http://localhost:<port>/',
      },
    },
  });

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText(`http://localhost:${result.port}`);

  const testEl2 = page.locator('#test2');
  await expect(testEl2).toHaveText(`http://localhost:${result.port}`);
});

test('should allow output.assetPrefix to be `auto`', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      output: {
        assetPrefix: 'auto',
      },
    },
  });

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText('auto');
});

test('should inject assetPrefix to env var and template correctly', async ({
  page,
  buildPreview,
}) => {
  await buildPreview({
    config: {
      html: {
        template: './src/template.html',
      },
      output: {
        assetPrefix: 'http://example.com',
        inlineScripts: true,
      },
    },
  });

  await expect(page.locator('#prefix1')).toHaveText('http://example.com');
  await expect(page.locator('#prefix2')).toHaveText('http://example.com');
});

test('should use output.assetPrefix in none mode', async ({ build }) => {
  const result = await build({
    config: {
      mode: 'none',
      dev: {
        assetPrefix: 'http://dev.com',
      },
      output: {
        assetPrefix: 'http://prod.com',
      },
    },
  });

  const files = result.getDistFiles();
  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain('http://prod.com');
  expect(indexHtml).not.toContain('http://dev.com');
});
