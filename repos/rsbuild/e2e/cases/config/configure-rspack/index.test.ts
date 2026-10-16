import { expect, test } from '@e2e/helper';

test('should allow to use tools.rspack to configure Rspack', async ({ page, runBothServe }) => {
  await runBothServe(
    async () => {
      const testEl = page.locator('#test-el');
      await expect(testEl).toHaveText('aaaaa');
    },
    {
      config: {
        tools: {
          rspack: (config, { rspack }) => {
            config.plugins.push(
              new rspack.DefinePlugin({
                ENABLE_TEST: JSON.stringify(true),
              }),
            );
          },
        },
      },
    },
  );
});

test('should allow to use async tools.rspack to configure Rspack', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(
    async () => {
      const testEl = page.locator('#test-el');
      await expect(testEl).toHaveText('aaaaa');
    },
    {
      config: {
        tools: {
          rspack: async (config, { rspack }) => {
            return new Promise<void>((resolve) => {
              setTimeout(() => {
                config.plugins.push(
                  new rspack.DefinePlugin({
                    ENABLE_TEST: JSON.stringify(true),
                  }),
                );
                resolve();
              }, 0);
            });
          },
        },
      },
    },
  );
});

test('should allow tools.rspack to be an array', async ({ page, runBothServe }) => {
  await runBothServe(
    async () => {
      const testEl = page.locator('#test-el');
      await expect(testEl).toHaveText('aaaaa');
    },
    {
      config: {
        tools: {
          rspack: [
            (config, { rspack }) => {
              config.plugins.push(
                new rspack.DefinePlugin({
                  ENABLE_TEST: JSON.stringify(true),
                }),
              );
            },
          ],
        },
      },
    },
  );
});
