import { expect, getFileContent, test } from '@e2e/helper';

const COMPILE_WARNING = 'Compile Warning';

test('should allow to enable Rspack experiments.css', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');

  expect(content).toEqual('body{color:red}');
  // should have no warnings
  rsbuild.expectNoLog(COMPILE_WARNING);
});

test('should allow to enable Rspack experiments.css with style-loader', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        injectStyles: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.js');
  expect(content).toContain('color:red');

  // should have no warnings
  rsbuild.expectNoLog(COMPILE_WARNING);
});
