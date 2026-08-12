import { expect, getRandomPort, test } from '@e2e/helper';

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
