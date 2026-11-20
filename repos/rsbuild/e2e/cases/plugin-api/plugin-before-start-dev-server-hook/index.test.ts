import { expect, gotoPage, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';

test('should run onBeforeStartDevServer hooks and add custom middleware', async ({ page, dev }) => {
  const plugin: RsbuildPlugin = {
    name: 'test-plugin',
    setup(api) {
      api.onBeforeStartDevServer(async ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/test.html') {
            res.end('Hello, world!');
          } else {
            next();
          }
        });

        return () => {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/test2.html') {
              res.end('Hello, world2!');
            } else {
              next();
            }
          });
        };
      });
    },
  };

  const rsbuild = await dev({
    config: {
      plugins: [plugin],
    },
  });

  await gotoPage(page, rsbuild, 'test');
  await expect(page.content()).resolves.toContain('Hello, world!');

  await gotoPage(page, rsbuild, 'test2');
  await expect(page.content()).resolves.toContain('Hello, world2!');
});
