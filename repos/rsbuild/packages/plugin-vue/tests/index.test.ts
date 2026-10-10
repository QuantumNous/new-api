import { createRsbuild } from '@rsbuild/core';
import { matchPlugin, matchRules } from '@scripts/test-helper';
import { pluginVue } from '../src';

describe('plugin-vue', () => {
  it('should add vue-loader and VueLoaderPlugin correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [pluginVue()],
      },
    });
    const config = await rsbuild.initConfigs();

    expect(matchRules(config[0], 'a.vue')[0]).toMatchSnapshot();
    expect(matchPlugin(config[0], 'VueLoaderPlugin')).toMatchSnapshot();
    expect(config[0].resolve).toMatchSnapshot();
  });

  it('should allow to configure vueLoader options', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginVue({
            vueLoaderOptions: {
              hotReload: false,
            },
          }),
        ],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.vue')[0]).toMatchSnapshot();
  });

  it('should define feature flags correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [pluginVue()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'DefinePlugin')).toMatchSnapshot();
  });

  it('should allow to custom test condition', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginVue({
            test: /\.(vue|md)$/,
          }),
        ],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.md')[0]).toMatchSnapshot();
  });
});
