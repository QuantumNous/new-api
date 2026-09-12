import { expect, test } from '@e2e/helper';
import { pluginReact } from '@rsbuild/plugin-react';

test('should provide history api fallback for dev server correctly', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: './src/index.jsx',
        },
      },
      server: {
        historyApiFallback: {
          index: '/main.html',
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);
  expect(await page.innerHTML('body')).toContain('<div>home<div>');

  await page.goto(`http://localhost:${rsbuild.port}/a`);
  expect(await page.innerHTML('body')).toContain('<div>A</div>');

  await page.goto(`http://localhost:${rsbuild.port}/b`);
  expect(await page.innerHTML('body')).toContain('<div>B</div>');
});

test('should provide history api fallback for preview server correctly', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: './src/index.jsx',
        },
      },
      server: {
        historyApiFallback: {
          index: '/main.html',
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);
  expect(await page.innerHTML('body')).toContain('<div>home<div>');

  await page.goto(`http://localhost:${rsbuild.port}/a`);
  expect(await page.innerHTML('body')).toContain('<div>A</div>');

  await page.goto(`http://localhost:${rsbuild.port}/b`);
  expect(await page.innerHTML('body')).toContain('<div>B</div>');
});
