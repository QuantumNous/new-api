import { expect, test } from '@e2e/helper';
import { pluginReact } from '@rsbuild/plugin-react';

test('should split react chunks correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('lib-react'))).toBeTruthy();
});

test('should not split react chunks when strategy is `all-in-one`', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      performance: {
        chunkSplit: {
          strategy: 'all-in-one',
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('lib-react'))).toBeFalsy();
});

test('should not split react chunks when splitChunks is disabled', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [
        pluginReact({
          splitChunks: false,
        }),
      ],
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('lib-react'))).toBeFalsy();
});

test('should not override user defined cache groups', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      performance: {
        chunkSplit: {
          override: {
            cacheGroups: {
              react: {
                name: 'my-react',
                test: /react/,
              },
            },
          },
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('my-react'))).toBeTruthy();
});
