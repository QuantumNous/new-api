import { expect, getFileContent, test } from '@e2e/helper';

test('should generate default title correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).toContain('<title>Rsbuild App</title>');
});

test('should allow setting empty title to unset the default title', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
      html: {
        title: '',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).not.toContain('<title>');
});

test('should generate title correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
      html: {
        title: 'foo',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).toContain('<title>foo</title>');
});

test('should generate title correctly when using custom HTML template', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
      html: {
        title: 'foo',
        template: './src/empty.html',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).toContain('<title>foo</title>');
});

test('should generate title correctly when using htmlPlugin.options.title', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
      html: {
        title: 'foo',
        template: './src/plugin-options-title.html',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).toContain('<title>foo</title>');
});

test('should generate title via function correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          foo: './src/foo.js',
          bar: './src/foo.js',
        },
      },
      html: {
        title({ entryName }) {
          return entryName;
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<title>foo</title>');

  const barHtml = getFileContent(files, 'bar.html');
  expect(barHtml).toContain('<title>bar</title>');
});

test('should not inject title if template already contains a title', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: { foo: './src/foo.js' },
      },
      html: {
        title: 'Hello',
        template: './src/title.html',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'foo.html');
  expect(html).toContain('<title>Page Title</title>');
});
