import { expect, test } from '@e2e/helper';

test('should respect tsconfig paths and override resolve.alias', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      resolve: {
        alias: {
          '@common': './src/common2',
        },
      },
    },
  });

  const foo = page.locator('#foo');
  await expect(foo).toHaveText('tsconfig paths worked');
});

test('should ignore tsconfig paths when aliasStrategy is "prefer-alias"', async ({
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
    },
  });

  const foo = page.locator('#foo');
  await expect(foo).toHaveText('resolve.alias worked');
});
