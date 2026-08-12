import { expect, getFileContent, test } from '@e2e/helper';

test('should set template via function correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      html: {
        template({ entryName }) {
          return entryName === 'index' ? './static/index.html' : './static/foo.html';
        },
        templateParameters: {
          foo: 'foo',
          type: 'type',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<div id="test-template">foo</div>');

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain('<div id="test-template">text</div>');
});

test('should set template via async function correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      html: {
        async template({ entryName }) {
          return entryName === 'index' ? './static/index.html' : './static/foo.html';
        },
        templateParameters: {
          foo: 'foo',
          type: 'type',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<div id="test-template">foo</div>');

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain('<div id="test-template">text</div>');
});

test('should allow to access templateParameters', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      html: {
        template: './static/index.html',
        templateParameters: {
          foo: 'bar',
        },
      },
    },
  });

  const testTemplate = page.locator('#test-template');
  await expect(testTemplate).toHaveText('text');

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText('Hello Rsbuild!');

  await expect(page.evaluate('window.foo')).resolves.toBe('bar');
});

test('should allow templateParameters to be a function', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      html: {
        template({ entryName }) {
          return entryName === 'foo' ? './static/foo.html' : './static/index.html';
        },
        templateParameters(defaultValue, { entryName }) {
          return {
            ...defaultValue,
            foo: `${entryName}-foo`,
            type: `${entryName}-type`,
          };
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain("window.foo = 'index-foo';");

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain("window.type = 'foo-type';");
});

test('should allow templateParameters to be an async function', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      html: {
        template({ entryName }) {
          return entryName === 'foo' ? './static/foo.html' : './static/index.html';
        },
        async templateParameters(defaultValue, { entryName }) {
          return {
            ...defaultValue,
            foo: `${entryName}-foo`,
            type: `${entryName}-type`,
          };
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain("window.foo = 'index-foo';");

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain("window.type = 'foo-type';");
});

test('should set template via tools.htmlPlugin correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      tools: {
        htmlPlugin(config, { entryName }) {
          config.template = entryName === 'index' ? './static/index.html' : './static/foo.html';
        },
      },
      html: {
        templateParameters: {
          foo: 'foo',
          type: 'type',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<div id="test-template">foo</div>');

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain('<div id="test-template">text</div>');
});
