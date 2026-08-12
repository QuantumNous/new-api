import { expect, getFileContent, test } from '@e2e/helper';
import type { RspackChain } from '@rsbuild/core';

// use source-map for easy to test. By default, Rsbuild use hidden-source-map
const toolsConfig = {
  bundlerChain: (chain: RspackChain) => {
    chain.devtool('source-map');
  },
  htmlPlugin: (config: any) => {
    // minify will remove sourcemap comment
    if (typeof config.minify === 'object') {
      config.minify.minifyJS = false;
      config.minify.minifyCSS = false;
    }
  },
};

test('should inline all scripts and emit all source maps', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          another: './src/another.js',
        },
      },
      output: {
        inlineScripts: true,
      },
      tools: toolsConfig,
    },
  });

  // test runtime
  expect(await page.evaluate('window.test')).toBe('aaaa');

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no entry chunks or runtime chunks in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.js') && !fileName.includes('/async/'),
    ).length,
  ).toEqual(0);

  // all source maps in output
  expect(Object.keys(files).filter((fileName) => fileName.endsWith('.js.map')).length).toEqual(3);
});

test('should inline scripts when matching a RegExp', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineScripts: /\/index\.\w+\.js$/,
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no index.js in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.js') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);

  // all source maps in output
  expect(
    Object.keys(files).filter((fileName) => fileName.endsWith('.js.map')).length,
  ).toBeGreaterThanOrEqual(2);
});

test('should inline scripts based on filename and size', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineScripts({ size, name }) {
          return name.includes('index') && size < 10000;
        },
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no index.js in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.js') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);

  // all source maps in output
  expect(
    Object.keys(files).filter((fileName) => fileName.endsWith('.js.map')).length,
  ).toBeGreaterThanOrEqual(2);
});

test('should inline styles when matching a RegExp', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineStyles: /\/index\.\w+\.css$/,
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no index.css in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.css') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);
});

test('should inline styles based on filename and size', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineStyles({ size, name }) {
          return name.includes('index') && size < 1000;
        },
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no index.css in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.css') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);
});

test('should not inline styles by default in dev', async ({ page, dev }) => {
  await dev({
    config: {
      tools: toolsConfig,
    },
  });

  // index.css in page
  await expect(
    page.evaluate(`document.querySelectorAll('link[href*="index.css"]').length`),
  ).resolves.toEqual(1);
});

test('should inline styles in dev when matching a RegExp', async ({ page, dev }) => {
  await dev({
    config: {
      output: {
        inlineStyles: {
          enable: true,
          test: /\.css$/,
        },
      },
      tools: toolsConfig,
    },
  });

  // no index.css in page
  await expect(
    page.evaluate(`document.querySelectorAll('link[href*="index.css"]').length`),
  ).resolves.toEqual(0);
});

test('should inline styles in dev based on filename and size', async ({ page, dev }) => {
  await dev({
    config: {
      output: {
        inlineStyles: {
          enable: true,
          test({ size, name }: { size: number; name: string }) {
            return name.includes('index') && size < 1000;
          },
        },
      },
      tools: toolsConfig,
    },
  });

  // no index.css in page
  await expect(
    page.evaluate(`document.querySelectorAll('link[href*="index.css"]').length`),
  ).resolves.toEqual(0);
});

test('should not inline scripts when disabled', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineScripts: {
          enable: false,
          test: /\.js$/,
        },
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // all index.js in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.js') && fileName.includes('/index.'),
    ).length,
  ).toEqual(1);

  // all source maps in output
  expect(
    Object.keys(files).filter((fileName) => fileName.endsWith('.js.map')).length,
  ).toBeGreaterThanOrEqual(2);
});

test('should not inline styles when disabled', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        inlineStyles: {
          enable: false,
          test: /\.css$/,
        },
      },
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // all index.css in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.css') && fileName.includes('/index.'),
    ).length,
  ).toEqual(1);
});

test('should inline assets in build when enable is auto', async ({ build }) => {
  const rsbuild = await build({
    config: {
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
      tools: toolsConfig,
    },
  });
  const files = rsbuild.getDistFiles({ sourceMaps: true });

  // no index.js in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.js') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);

  // all source maps in output
  expect(
    Object.keys(files).filter((fileName) => fileName.endsWith('.js.map')).length,
  ).toBeGreaterThanOrEqual(2);

  // no index.css in output
  expect(
    Object.keys(files).filter(
      (fileName) => fileName.endsWith('.css') && fileName.includes('/index.'),
    ).length,
  ).toEqual(0);
});

test('should not inline assets in dev when enable is auto', async ({ page, dev }) => {
  await dev({
    config: {
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
      tools: toolsConfig,
    },
  });

  // all index.js in page
  await expect(
    page.evaluate(`document.querySelectorAll('script[src*="index.js"]').length`),
  ).resolves.toEqual(1);

  // all index.css in page
  await expect(
    page.evaluate(`document.querySelectorAll('link[href*="index.css"]').length`),
  ).resolves.toEqual(1);
});

test('should not inline scripts or styles in dev by default when enable is unset', async ({
  page,
  dev,
}) => {
  await dev({
    config: {
      tools: toolsConfig,
      output: {
        inlineStyles: true,
        inlineScripts: /\.js$/,
      },
    },
  });

  // all index.js in page
  await expect(
    page.evaluate(`document.querySelectorAll('script[src*="index.js"]').length`),
  ).resolves.toEqual(1);

  // all index.css in page
  await expect(
    page.evaluate(`document.querySelectorAll('link[href*="index.css"]').length`),
  ).resolves.toEqual(1);
});

test('should inline assets independently for multiple environments', async ({ build }) => {
  const rsbuild = await build({
    config: {
      environments: {
        web: {
          source: {
            entry: {
              index: './src/index.js',
            },
          },
          output: {
            filenameHash: false,
            distPath: { root: 'dist/web' },
            inlineScripts: true,
            inlineStyles: true,
          },
        },
        web1: {
          source: {
            entry: {
              index: './src/index.js',
            },
          },
          output: {
            filenameHash: false,
            distPath: { root: 'dist/web1' },
            inlineScripts: true,
            inlineStyles: true,
          },
        },
      },
      tools: toolsConfig,
    },
  });

  const files = rsbuild.getDistFiles();

  const getHtml = (root: string) => {
    const htmlPath = Object.keys(files).find(
      (file) => file.includes(root) && file.endsWith('/index.html'),
    );
    expect(htmlPath).toBeTruthy();
    return files[htmlPath!];
  };

  const webHtml = getHtml('/dist/web/');
  const web1Html = getHtml('/dist/web1/');

  expect(webHtml).toContain('window.test');
  expect(web1Html).toContain('window.test');

  const countJs = (root: string) =>
    Object.keys(files).filter(
      (file) => file.includes(root) && file.endsWith('.js') && !file.includes('/async/'),
    ).length;

  const countCss = (root: string) =>
    Object.keys(files).filter((file) => file.includes(root) && file.endsWith('.css')).length;

  expect(countJs('/dist/web/')).toEqual(0);
  expect(countJs('/dist/web1/')).toEqual(0);
  expect(countCss('/dist/web/')).toEqual(0);
  expect(countCss('/dist/web1/')).toEqual(0);
});

test('should update source mapping URL in build', async ({ build }) => {
  const assetPrefix = 'https://example.com/base/';
  const rsbuild = await build({
    config: {
      output: {
        filenameHash: false,
        inlineScripts: true,
        assetPrefix,
      },
      tools: toolsConfig,
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const indexHtml = getFileContent(files, '/index.html');

  expect(
    indexHtml.includes(`//# sourceMappingURL=${assetPrefix}static/js/index.js.map`),
  ).toBeTruthy();
});
