import { expect, test } from '@e2e/helper';
import { getRandomPort } from '@rstackjs/test-utils';

test('should set the port via server.port', async ({ page, dev }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const port = await getRandomPort();
  const rsbuild = await dev({
    config: {
      server: {
        port,
      },
    },
  });

  expect(rsbuild.port).toBe(port);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  expect(errors).toEqual([]);
});
