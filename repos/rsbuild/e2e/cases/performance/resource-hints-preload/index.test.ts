import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { findFile, getFileContent } from '@rstackjs/test-utils';
import { pluginReact } from '@rsbuild/plugin-react';

const fixtures = import.meta.dirname;

test('should generate preload link when preload is defined', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const textFileName = findFile(files, /\/static\/assets\/.+\.txt$/);
  const content = getFileContent(files, '.html');

  // test.js, test.css, image.png
  expect(content.match(/rel="preload"/g)?.length).toBe(3);
  expect(content).not.toContain(textFileName.slice(textFileName.indexOf('/static/assets/')));

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="preload" as="script">`,
    ),
  ).toBeTruthy();
});

test('should allow preload.exclude to override default asset excludes', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: {
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
  expect(content.match(/rel="preload"/g)?.length).toBe(3);
  expect(content).toContain(textHref);
});

test('should generate preload link with duplicate', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: {
          type: 'initial',
          dedupe: false,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const initialFileName = findFile(files, /\/static\/js\/(?!async\/)[^/]+\.js$/);
  const content = getFileContent(files, '.html');

  expect(
    content.includes(
      `<link href="${initialFileName.slice(
        initialFileName.indexOf('/static/js/'),
      )}" rel="preload" as="script">`,
    ),
  ).toBeTruthy();
});

test('should generate preload link with crossOrigin', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      html: {
        crossorigin: 'anonymous',
      },
      output: {
        assetPrefix: '//aaa.com',
      },
      performance: {
        preload: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const content = getFileContent(files, '.html');

  // test.js, test.css, image.png
  expect(content.match(/rel="preload"/g)?.length).toBe(3);

  expect(
    content.includes(
      `<link href="//aaa.com${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="preload" as="script" crossorigin="">`,
    ),
  ).toBeTruthy();
});

test('should generate preload link without crossOrigin when same origin', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      html: {
        crossorigin: 'anonymous',
      },
      performance: {
        preload: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const content = getFileContent(files, '.html');

  // test.js, test.css, image.png
  expect(content.match(/rel="preload"/g)?.length).toBe(3);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="preload" as="script">`,
    ),
  ).toBeTruthy();
});

test('should generate preload link with include', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: {
          include: /\.png$/,
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, 'image.png');
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="preload"/g)?.length).toBe(1);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/image/image'),
      )}" rel="preload" as="image">`,
    ),
  ).toBeTruthy();
});

test('should generate preload link with include array', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: {
          include: [/\.png$/, (filename) => filename.includes('.js')],
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const asyncFileName = findFile(files, 'image.png');
  const content = getFileContent(files, '.html');

  // image.png, test.js
  expect(content.match(/rel="preload"/g)?.length).toBe(2);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/image/image'),
      )}" rel="preload" as="image">`,
    ),
  ).toBeTruthy();
});

test('should generate preload link with options array', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      source: {
        entry: {
          main: join(fixtures, 'src/page1/index.ts'),
        },
      },
      performance: {
        preload: [
          {
            include: /\.js$/,
          },
          {
            type: 'all-chunks',
            include: /icon\..+\.png$/,
          },
          {
            type: 'initial',
            include: /main\..+\.js$/,
            dedupe: false,
          },
          {
            type: 'initial',
            include: /main\..+\.js$/,
            dedupe: false,
          },
        ],
      },
    },
  });

  const files = rsbuild.getDistFiles();

  const iconFileName = findFile(files, 'icon.png');
  const asyncFileName = findFile(files, /\/static\/js\/async\/.+\.js$/);
  const initialFileName = findFile(files, /\/static\/js\/main\.js$/);
  const content = getFileContent(files, '.html');

  // test.js, icon.png, main.js
  expect(content.match(/rel="preload"/g)?.length).toBe(3);

  expect(
    content.includes(
      `<link href="${asyncFileName.slice(
        asyncFileName.indexOf('/static/js/async/'),
      )}" rel="preload" as="script">`,
    ),
  ).toBeTruthy();

  expect(
    content.includes(
      `<link href="${iconFileName.slice(
        iconFileName.indexOf('/static/image/icon'),
      )}" rel="preload" as="image">`,
    ),
  ).toBeTruthy();

  expect(
    content.includes(
      `<link href="${initialFileName.slice(
        initialFileName.indexOf('/static/js/main'),
      )}" rel="preload" as="script">`,
    ),
  ).toBeTruthy();
});

test('should not generate preload link for inlined assets', async ({ build }) => {
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
        preload: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="preload" as="/g)?.length).toBe(1);
});

test('should not generate preload link for inlined assets with test option', async ({ build }) => {
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
        preload: true,
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.html');

  // image.png
  expect(content.match(/rel="preload" as="/g)?.length).toBe(1);
});
