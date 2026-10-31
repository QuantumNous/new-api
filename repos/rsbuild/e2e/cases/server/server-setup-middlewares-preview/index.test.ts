import { expect, test } from '@e2e/helper';

test('should apply server.setup in both dev and preview mode', async ({ runBothServe }) => {
  await runBothServe(
    async ({ result }) => {
      const res = await fetch(`http://localhost:${result.port}/api/shared`);
      expect(await res.text()).toBe('shared-ok');
    },
    {
      config: {
        server: {
          setup: ({ server }) => {
            server.middlewares.use((req, res, next) => {
              if (req.url === '/api/shared') {
                res.end('shared-ok');
                return;
              }
              next();
            });
          },
        },
      },
    },
  );
});

test('should apply server.setup in preview mode', async ({ page, buildPreview }) => {
  let middlewareCount = 0;

  await buildPreview({
    config: {
      server: {
        setup: ({ server }) => {
          server.middlewares.use((_req, _res, next) => {
            middlewareCount++;
            next();
          });
        },
      },
    },
  });

  const locator = page.locator('#root');
  await expect(locator).toHaveText('Hello Rsbuild!');
  expect(middlewareCount).toBeGreaterThanOrEqual(1);
});

test('should apply server.setup for custom API route', async ({ buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      server: {
        setup: ({ server }) => {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/test') {
              res.end('api-ok');
              return;
            }
            next();
          });
        },
      },
    },
  });

  // Test custom API route via server.setup
  const res = await fetch(`http://localhost:${rsbuild.port}/api/test`);
  expect(await res.text()).toBe('api-ok');
});

test('should support multiple server.setup functions', async ({ page, buildPreview }) => {
  let firstCalled = false;
  let secondCalled = false;

  await buildPreview({
    config: {
      server: {
        setup: [
          ({ server }) => {
            server.middlewares.use((_req, _res, next) => {
              firstCalled = true;
              next();
            });
          },
          ({ server }) => {
            server.middlewares.use((_req, _res, next) => {
              secondCalled = true;
              next();
            });
          },
        ],
      },
    },
  });

  const locator = page.locator('#root');
  await expect(locator).toHaveText('Hello Rsbuild!');
  expect(firstCalled).toBe(true);
  expect(secondCalled).toBe(true);
});

test('should run returned callback after internal middlewares', async ({ buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      server: {
        historyApiFallback: false,
        htmlFallback: false,
        setup: ({ server }) => {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/api/order') {
              req.headers['x-server-setup-order'] = 'before';
            }
            next();
          });

          return () => {
            server.middlewares.use((req, res, next) => {
              if (req.url === '/api/order') {
                res.end(req.headers['x-server-setup-order']);
                return;
              }
              next();
            });
          };
        },
      },
    },
  });

  const res = await fetch(`http://localhost:${rsbuild.port}/api/order`);
  expect(await res.text()).toBe('before');
});
