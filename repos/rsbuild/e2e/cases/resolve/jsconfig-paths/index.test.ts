import { expect, test } from '@e2e/helper';

test('tsconfig paths should work and override the alias config', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      resolve: {
        alias: {
          '@common': './src/common2',
        },
      },
      source: {
        tsconfigPath: './jsconfig.json',
      },
    },
  });

  const foo = page.locator('#foo');
  await expect(foo).toHaveText('tsconfig paths worked');
});

test('tsconfig paths should not work when aliasStrategy is "prefer-alias"', async ({
  page,
  buildPreview,
}) => {
  await buildPreview({
    config: {
      resolve: {
        alias: {
          '@/common': './src/common2',
        },
        aliasStrategy: 'prefer-alias',
      },
      source: {
        tsconfigPath: './jsconfig.json',
      },
    },
  });

  const foo = page.locator('#foo');
  await expect(foo).toHaveText('resolve.alias worked');
});
