import { expect, getFileContent, test } from '@e2e/helper';

const EXPECTED_ERROR = 'CSS Modules do not support the ?url query';

test('should throw error when importing CSS Modules with `?url`', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
  });

  expect(rsbuild.buildError).toBeTruthy();
  await rsbuild.expectLog(EXPECTED_ERROR);
});

test('should allow `.module.css?url` when CSS Modules auto is disabled', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        filenameHash: false,
      },
      tools: {
        cssLoader: {
          modules: {
            auto: false,
          },
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const jsContent = getFileContent(files, 'index.js');
  const cssContent = getFileContent(files, 'style.module.css');
  expect(jsContent).toContain('static/css/style.module.css');
  expect(cssContent).toContain('.title{color:red}');
});
