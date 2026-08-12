import { expect, getFileContent, test } from '@e2e/helper';

test('should not apply crossOrigin by default', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        scriptLoading: 'blocking',
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html).not.toContain('crossorigin');
});

test('should apply crossOrigin when crossorigin is "anonymous" and not same origin', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      html: {
        scriptLoading: 'blocking',
        crossorigin: 'anonymous',
      },
      output: {
        assetPrefix: '//aaaa.com',
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html).toContain('crossorigin="anonymous"></script>');
});
