import { expect, expectPoll, test } from '@e2e/helper';

test('should apply custom middleware via `server.setup`', async ({ page, dev }) => {
  let count = 0;

  await dev({
    config: {
      server: {
        setup: ({ action, server }) => {
          if (action !== 'dev') {
            return;
          }

          server.middlewares.use((_req, _res, next) => {
            count++;
            next();
          });
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
  expect(count).toBeGreaterThanOrEqual(1);
});

test('should apply to trigger page reload via `environment.hot.send` in server.setup', async ({
  page,
  dev,
}) => {
  let count = 0;
  let reloadPage: undefined | (() => void);

  await dev({
    config: {
      server: {
        setup: ({ action, server }) => {
          if (action !== 'dev') {
            return;
          }

          server.middlewares.use((_req, _res, next) => {
            count++;
            next();
          });
          reloadPage = () => server.environments.web.hot.send('full-reload');
        },
      },
    },
  });

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');
  const previousCount = count;
  reloadPage?.();
  await expectPoll(() => count > previousCount).toBeTruthy();
});
