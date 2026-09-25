import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

const commonConfig = {
  html: {
    template: './src/index.html',
  },
  output: {
    minify: false,
  },
  tools: {
    lightningcssLoader: false,
  },
};

test('should enable Tailwind optimization by default in production mode', async ({ build }) => {
  const rsbuild = await build({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss()],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('.card .title');
  expect(css).toMatch(/\.underline \{\n\s+text-decoration-line: underline;\n\s+\}/);
  expect(css).not.toContain('.underline{text-decoration-line:underline}');
});

test('should disable Tailwind optimization by default in development mode', async ({ dev }) => {
  const rsbuild = await dev({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss()],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('& .title');
});

test('should disable Tailwind optimization when optimize is false', async ({ build }) => {
  const rsbuild = await build({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss({ optimize: false })],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('& .title');
});

test('should enable Tailwind minify when optimize is true', async ({ build }) => {
  const rsbuild = await build({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss({ optimize: true })],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('.card .title');
  expect(css).toContain('.underline{text-decoration-line:underline}');
});

test('should keep Tailwind minify disabled when optimize minify is omitted', async ({ build }) => {
  const rsbuild = await build({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss({ optimize: {} })],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('.card .title');
  expect(css).toMatch(/\.underline \{\n\s+text-decoration-line: underline;\n\s+\}/);
  expect(css).not.toContain('.underline{text-decoration-line:underline}');
});

test('should enable Tailwind minify when optimize minify is true', async ({ build }) => {
  const rsbuild = await build({
    config: {
      ...commonConfig,
      plugins: [pluginTailwindcss({ optimize: { minify: true } })],
    },
  });

  const css = getFileContent(rsbuild.getDistFiles(), 'index.css');
  expect(css).toContain('.card .title');
  expect(css).toContain('.underline{text-decoration-line:underline}');
});
