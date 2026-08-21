import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { findFile, getFileContent } from '@rstackjs/test-utils';
import { pluginReact } from '@rsbuild/plugin-react';

const fixtures = import.meta.dirname;

test('should generate prefetch link when prefetch is defined', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      output: {
        assetPrefix: 'https://www.foo.com',
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const textFileName = findFile(files, /\/static\/assets\/.+\.txt$/);
  const content = getFileContent(files, '.html');

  // test.js, test.css, image.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(3);
  expect(content).not.toContain(textFileName.slice(textFileName.indexOf('/static/assets/')));

  expect(
    content.includes(
      `<link href="https://www.foo.com${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
});

test('should allow prefetch.exclude to override default asset excludes', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: {
          exclude: /\.css$/,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const textFileName = findFile(files, /\/static\/assets\/.+\.txt$/);
  const content = getFileContent(files, '.html');
  const textHref = textFileName.slice(textFileName.indexOf('/static/assets/'));

  // test.js, image.png, file.txt
  expect(content.match(/rel="prefetch"/g)?.length).toBe(3);
  expect(content).toContain(`<link href="${textHref}" rel="prefetch">`);
});

test('should generate prefetch link correctly when assetPrefix do not have a protocol', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      output: {
        assetPrefix: '//www.foo.com',
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const content = getFileContent(files, '.html');

  expect(
    content.includes(
      `<link href="//www.foo.com${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
});

test('should generate prefetch link with include', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: {
          include: /\.png$/,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, 'image.png');
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(1);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/image/image'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
});

test('should generate prefetch link with include array', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: {
          include: [/\.png$/, (filename) => filename.includes('.js')],
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, 'image.png');
  const content = getFileContent(files, '.html');

  // image.png, test.js
  expect(content.match(/rel="prefetch"/g)?.length).toBe(2);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/image/image'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
});

test('should generate prefetch link with options array', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: [
          {
            include: /\.js$/,
          },
          {
            type: 'all-chunks',
            include: /icon\..+\.png$/,
          },
          {
            type: 'all-chunks',
            include: /icon\..+\.png$/,
          },
        ],
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const iconFileName = findFile(files, 'icon.png');
  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const content = getFileContent(files, '.html');

  // test.js, icon.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(2);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();

  expect(
    content.includes(
      `<link href="${iconFileName.slice(
        iconFileName.indexOf('/static/image/icon'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
});

test('should generate prefetch link with exclude array', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: {
          exclude: [/\.css$/, (filename) => filename.includes('.js')],
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, 'image.png');
  const textFileName = findFile(files, /\/static\/assets\/.+\.txt$/);
  const content = getFileContent(files, '.html');
  const textHref = textFileName.slice(textFileName.indexOf('/static/assets/'));

  // image.png, file.txt
  expect(content.match(/rel="prefetch"/g)?.length).toBe(2);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/image/image'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();
  expect(content).toContain(`<link href="${textHref}" rel="prefetch">`);
});

test('should generate prefetch link by config (distinguish html)', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          page1: join(fixtures, 'src/page1/index.ts'),
          page2: join(fixtures, 'src/page2/index.ts'),
        },
      },
      performance: {
        prefetch: {
          type: 'all-chunks',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, 'page1.html');

  // icon.png、test.js, test.css, image.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(4);

  const assetFileName = findFile(files, 'image.png');

  expect(
    content.includes(
      `<link href="${assetFileName.slice(
        assetFileName.indexOf('/static/image/'),
      )}" rel="prefetch">`,
    ),
  ).toBeTruthy();

  const content2 = getFileContent(files, 'page2.html');

  // test.js, test.css, image.png
  expect(content2.match(/rel="prefetch"/g)?.length).toBe(3);
});

test('should not generate prefetch link for linked legal comment assets in all-assets mode', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        prefetch: {
          type: 'all-assets',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const licenseFileName = findFile(files, /\.LICENSE\.txt$/);
  const content = getFileContent(files, '.html');
  expect(licenseFileName).toBeTruthy();
  expect(content.includes('.LICENSE.txt')).toBeFalsy();
});

test('should not generate prefetch link for inlined assets', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      output: {
        inlineScripts: true,
        inlineStyles: true,
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(1);
});

test('should not generate prefetch link for inlined assets with test option', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      output: {
        inlineScripts: {
          enable: 'auto',
          test: /\.js$/,
        },
        inlineStyles: {
          enable: 'auto',
          test: /\.css$/,
        },
      },
      performance: {
        prefetch: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="prefetch"/g)?.length).toBe(1);
});
