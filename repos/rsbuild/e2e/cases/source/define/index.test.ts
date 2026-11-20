import { expect, test } from '@e2e/helper';

test('should allow to define global variables', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const testEl = page.locator('#test-el');
    await expect(testEl).toHaveText('aaaaa');
  });
});

test('should warn when define `process.env`', async ({ buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        define: {
          'process.env': process.env,
        },
      },
    },
  });

  await rsbuild.expectLog('The "source.define" option includes an object');
});

test('should warn when define stringified `process.env`', async ({ buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        define: {
          'process.env': JSON.stringify(process.env),
        },
      },
    },
  });

  await rsbuild.expectLog('The "source.define" option includes an object');
});
