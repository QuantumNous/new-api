import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { findFile, getFileContent } from '@rstackjs/test-utils';
import fse from 'fs-extra';

test('should emit local favicon to dist path', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: '../../../assets/icon.png',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const icon = findFile(files, 'icon.png');
  expect(icon.endsWith('/icon.png')).toBeTruthy();

  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="/icon.png">');
});

test('should allow `html.favicon` to be an absolute path', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: path.resolve(import.meta.dirname, '../../../assets/icon.png'),
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const icon = findFile(files, 'icon.png');
  expect(icon.endsWith('/icon.png')).toBeTruthy();

  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="/icon.png">');
});

test('should add type attribute for SVG favicon', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: '../../../assets/mobile.svg',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const icon = findFile(files, 'mobile.svg');
  expect(icon.endsWith('/mobile.svg')).toBeTruthy();

  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="/mobile.svg" type="image/svg+xml">');
});

test('should apply asset prefix to favicon URL', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: '../../../assets/icon.png',
      },
      output: {
        assetPrefix: 'https://www.example.com',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'index.html');

  expect(html).toContain('<link rel="icon" href="https://www.example.com/icon.png">');
});

test('should allow favicon to be a CDN URL', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: 'https://foo.com/icon.png',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="https://foo.com/icon.png">');
});

test('should generate favicon via function correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          foo: './src/foo.js',
          bar: './src/foo.js',
        },
      },
      html: {
        favicon({ entryName }) {
          const icons: Record<string, string> = {
            foo: 'https://example.com/foo.ico',
            bar: 'https://example.com/bar.ico',
          };
          return icons[entryName] || 'https://example.com/default.ico';
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<link rel="icon" href="https://example.com/foo.ico">');

  const barHtml = getFileContent(files, 'bar.html');
  expect(barHtml).toContain('<link rel="icon" href="https://example.com/bar.ico">');
});

test('should allow to custom favicon dist path with a relative path', async ({ build }) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: '../../../assets/icon.png',
      },
      output: {
        distPath: {
          favicon: 'static/favicon',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const faviconFile = findFile(files, 'static/favicon/icon.png');
  expect(faviconFile.endsWith('/static/favicon/icon.png')).toBeTruthy();

  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="/static/favicon/icon.png">');
});

test('should allow to custom favicon dist path with a relative path starting with ./', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      html: {
        favicon: '../../../assets/icon.png',
      },
      output: {
        distPath: {
          favicon: './custom',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const faviconFile = findFile(files, 'custom/icon.png');
  expect(faviconFile.endsWith('/custom/icon.png')).toBeTruthy();

  const html = getFileContent(files, 'index.html');
  expect(html).toContain('<link rel="icon" href="/custom/icon.png">');
});

for (const filename of ['favicon.ico', 'favicon.png', 'favicon.svg']) {
  const publicPath = path.join(import.meta.dirname, 'test-temp-public');

  test(`should resolve ${filename} under public dir by default`, async ({ build }) => {
    await fse.remove(publicPath);
    await fse.outputFile(path.join(publicPath, filename), '');

    const rsbuild = await build({
      config: {
        server: {
          publicDir: { name: publicPath },
        },
      },
    });

    const files = rsbuild.getDistFiles();
    const faviconFile = findFile(files, filename);
    expect(faviconFile.endsWith(`/${filename}`)).toBeTruthy();

    const html = getFileContent(files, 'index.html');
    expect(html).toContain(`<link rel="icon" href="/${filename}"`);
  });
}
