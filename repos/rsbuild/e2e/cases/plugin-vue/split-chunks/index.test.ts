import { expect, test } from '@e2e/helper';
import { pluginVue } from '@rsbuild/plugin-vue';

test('should split vue chunks correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginVue()],
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('lib-vue'))).toBeTruthy();
});

test('should not split vue chunks when strategy is `all-in-one`', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginVue()],
      splitChunks: false,
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('lib-vue'))).toBeFalsy();
});

test('should not override user defined cache groups', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginVue()],
      splitChunks: {
        cacheGroups: {
          vue: {
            name: 'my-vue',
            test: /vue/,
          },
        },
      },
    },
  });

  const files = rsbuild.getDistFiles();
  const filesNames = Object.keys(files);
  expect(filesNames.find((file) => file.includes('my-vue'))).toBeTruthy();
});
