import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow to set development mode when building', async ({ build }) => {
  const rsbuild = await build({
    config: {
      mode: 'development',
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // should not have filename hash in dev
  const indexJs = getFileContent(files, 'static/js/index.js');

  // should replace `process.env.NODE_ENV` with `'development'`
  expect(indexJs).toContain('this is development mode!');

  // should not remove comments
  expect(indexJs).toContain('// this is a comment');

  // should have JavaScript source map
  expect(() => getFileContent(files, 'static/js/index.js.map')).not.toThrow();
});

test('should allow to set none mode when building', async ({ build }) => {
  const rsbuild = await build({
    config: {
      mode: 'none',
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // should not have filename hash in none mode
  const indexJs = getFileContent(files, 'static/js/index.js');

  expect(indexJs).toContain('this is none mode!');

  // should not remove comments
  expect(indexJs).toContain('// this is a comment');
});

test('should allow to set production mode when starting dev server', async ({
  page,
  dev,
  logHelper,
}) => {
  const browserErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (consoleMessage) => {
    const text = consoleMessage.text();
    logHelper.addLog(text);
    if (consoleMessage.type() === 'error') {
      browserErrors.push(text);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const rsbuild = await dev({
    config: {
      mode: 'production',
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // should have filename hash in build
  const indexJs = getFileContent(files, (key) => /static\/js\/index\.\w+\.js/.test(key), {
    ignoreHash: false,
  });

  // should replace `process.env.NODE_ENV` with `'production'`
  expect(indexJs).toContain('this is production mode!');

  // should print the expected runtime log after page visit
  await logHelper.expectLog('this is production mode!');

  // should not have runtime errors in browser
  expect(browserErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  // should remove comments
  expect(indexJs).not.toContain('// this is a comment');

  // should not have JavaScript source map
  expect(() => getFileContent(files, '.js.map')).toThrow();
});
