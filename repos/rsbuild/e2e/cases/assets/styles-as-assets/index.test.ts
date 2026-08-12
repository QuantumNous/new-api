import { expect, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';

test('should allow to use `new URL` to reference styles as assets', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);

  const test1 = filenames.find((filename) => filename.includes('dist/static/assets/test1.css'));
  const test2 = filenames.find((filename) => filename.includes('dist/static/assets/test2.less'));
  const test3 = filenames.find((filename) => filename.includes('dist/static/assets/test3.scss'));

  expect(test1).toBeDefined();
  expect(test2).toBeDefined();
  expect(test3).toBeDefined();
  expect(files[test1!]).toContain('body{color:red}');
  expect(files[test2!]).toContain('& .foo');
  expect(files[test3!]).toContain('& .foo');
  expect(await page.evaluate('window.test1')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test1.css`,
  );
  expect(await page.evaluate('window.test2')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test2.less`,
  );
  expect(await page.evaluate('window.test3')).toBe(
    `http://localhost:${rsbuild.port}/static/assets/test3.scss`,
  );
});

test('should serve one-byte assets', async ({ page, runBothServe }) => {
  const emitOneByteAssetPlugin: RsbuildPlugin = {
    name: 'emit-one-byte-asset',
    setup(api) {
      api.processAssets(
        {
          stage: 'additional',
        },
        ({ compilation, sources }) => {
          compilation.emitAsset('static/assets/one-byte.txt', new sources.RawSource('a'));
        },
      );
    },
  };

  await runBothServe(
    async ({ result }) => {
      const res = await page.goto(`http://localhost:${result.port}/static/assets/one-byte.txt`);

      expect(res?.status()).toBe(200);
      expect(res?.headers()['content-length']).toBe('1');
      expect((await res?.body())?.toString()).toBe('a');
    },
    {
      config: {
        plugins: [emitOneByteAssetPlugin],
      },
    },
  );
});
