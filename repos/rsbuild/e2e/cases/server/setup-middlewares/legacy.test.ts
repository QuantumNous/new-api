import { expect, expectPoll, test } from '@e2e/helper';

test('should apply custom middleware via `setupMiddlewares`', async ({ page, dev }) => {
  let count = 0;

  await dev({
    config: {
      dev: {
        setupMiddlewares: (middlewares) => {
          middlewares.unshift((_req, _res, next) => {
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

test('should apply to trigger page reload via the `static-changed` type of sockWrite in setupMiddlewares', async ({
  page,
  dev,
}) => {
  let count = 0;
  let reloadPage: undefined | (() => void);

  await dev({
    config: {
      dev: {
        setupMiddlewares: (middlewares, { sockWrite }) => {
          middlewares.unshift((_req, _res, next) => {
            count++;
            next();
          });
          reloadPage = () => sockWrite('static-changed');
        },
      },
    },
  });

  await expect(page.locator('#test')).toHaveText('Hello Rsbuild!');
  const previousCount = count;
  reloadPage?.();
  await expectPoll(() => count > previousCount).toBeTruthy();
});
