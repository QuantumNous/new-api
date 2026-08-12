import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should escape template parameters correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        templateParameters: {
          text: '<div>escape me</div>',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('&lt;div&gt;escape me&lt;/div&gt;');

  const barHtml = getFileContent(files, 'bar.html');
  expect(barHtml).toContain('<div>escape me</div>');
});

test('should allow to passing undefined to template parameters', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        templateParameters: {
          text: undefined,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<div id="test"></div>');

  const barHtml = getFileContent(files, 'bar.html');
  expect(barHtml).toContain('<div id="test"></div>');

  expect(rsbuild.buildError).toBeFalsy();
});
