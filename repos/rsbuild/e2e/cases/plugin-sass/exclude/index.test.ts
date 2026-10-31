import { expect, test } from '@e2e/helper';

test('should exclude specified Sass files using the exclude option', async ({ build }) => {
  const rsbuild = await build({
    config: {
      tools: {
        bundlerChain(chain) {
          chain.module
            .rule('fallback')
            .test(/b\.scss$/)
            .type('asset/resource');
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  const scssFiles = Object.keys(files).filter((file) => file.endsWith('.scss'));

  expect(scssFiles.length).toBe(1);
  expect(cssFiles.length).toBe(1);
});
