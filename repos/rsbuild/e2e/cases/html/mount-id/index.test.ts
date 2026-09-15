import fs from 'node:fs';
import { join } from 'node:path';
import { expect, gotoPage, test } from '@e2e/helper';

test.describe('should render mountId correctly', () => {
  test('should render content into the configured mountId', async ({ page, build }) => {
    const rsbuild = await build({
      runServer: true,
      config: {
        html: {
          mountId: 'app',
        },
      },
    });

    const errors = [] as string[];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoPage(page, rsbuild);

    const testEl = page.locator('#test');
    await expect(testEl).toHaveText('Hello Rsbuild!');

    expect(errors).toEqual([]);
  });

  test('should inject scripts into <head> by default', async ({ build }) => {
    const rsbuild = await build({
      config: {
        html: {
          mountId: 'app',
        },
      },
    });

    const pagePath = join(rsbuild.distPath, 'index.html');
    const content = await fs.promises.readFile(pagePath, 'utf-8');

    expect(/<head>[\s\S]*<script[\s\S]*>[\s\S]*<\/head>/.test(content)).toBeTruthy();
    expect(/<body>[\s\S]*<script[\s\S]*>[\s\S]*<\/body>/.test(content)).toBeFalsy();
  });
});
