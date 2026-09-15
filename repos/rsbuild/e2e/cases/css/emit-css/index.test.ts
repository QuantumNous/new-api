import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should not emit CSS files when build node target', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  // preserve CSS Modules mapping
  const jsContent = getFileContent(files, 'index.js');
  expect(jsContent.includes('"title-class":')).toBeTruthy();

  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  expect(cssFiles).toHaveLength(0);
});

test('should allow to emit CSS with output.emitCss when build node target', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        emitCss: true,
      },
    },
  });
  const files = rsbuild.getDistFiles();

  // preserve CSS Modules mapping
  const jsContent = getFileContent(files, 'index.js');
  expect(jsContent.includes('"title-class":')).toBeTruthy();

  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  expect(cssFiles).toHaveLength(1);
});

test('should not emit CSS files when build web-worker target', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web-worker',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  // preserve CSS Modules mapping
  const jsContent = getFileContent(files, 'index.js');
  expect(jsContent.includes('"title-class":')).toBeTruthy();

  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  expect(cssFiles).toHaveLength(0);
});

test('should allow to emit CSS with output.emitCss when build web-worker target', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web-worker',
        emitCss: true,
      },
    },
  });
  const files = rsbuild.getDistFiles();

  // preserve CSS Modules mapping
  const jsContent = getFileContent(files, 'index.js');
  expect(jsContent.includes('"title-class":')).toBeTruthy();

  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  expect(cssFiles).toHaveLength(1);
});

test('should allow to disable CSS emit with output.emitCss when build web target', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web',
        emitCss: false,
      },
    },
  });
  const files = rsbuild.getDistFiles();

  // preserve CSS Modules mapping
  const jsContent = getFileContent(files, 'index.js');
  expect(jsContent.includes('"title-class":')).toBeTruthy();

  const cssFiles = Object.keys(files).filter((file) => file.endsWith('.css'));
  expect(cssFiles).toHaveLength(0);
});
