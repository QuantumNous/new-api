import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow to force filename hash in development mode', async ({ build }) => {
  const rsbuild = await build({
    config: {
      mode: 'development',
      output: {
        filenameHash: {
          enable: 'always',
          format: 'contenthash:8',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const indexJs = getFileContent(files, (key) => /static\/js\/index\.\w{8}\.js$/.test(key), {
    ignoreHash: false,
  });
  const indexCss = getFileContent(files, (key) => /static\/css\/index\.\w{8}\.css$/.test(key), {
    ignoreHash: false,
  });

  expect(indexJs).toContain('filename hash in development mode');
  expect(indexCss).toContain('.root');
});
