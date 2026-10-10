import type { RspackPluginInstance } from '@rspack/core';
import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild, defineConfig, mergeRsbuildConfig, rspack } from '../src';

describe('configure Rspack', () => {
  it('should allow tools.rspack to return config', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack(config) {
            return {
              ...config,
              devtool: 'eval',
            };
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('eval');
  });

  it('should allow tools.rspack to modify config object', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack(config) {
            config.devtool = 'eval-cheap-source-map';
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('eval-cheap-source-map');
  });

  it('should allow tools.rspack to be an object', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack: {
            devtool: 'eval',
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('eval');
  });

  it('should allow tools.rspack to be an array', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack: [
            {
              devtool: 'eval',
            },
            (config) => {
              config.devtool = 'source-map';
            },
          ],
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('source-map');
  });

  it('should provide mergeConfig util in tools.rspack function', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack: (config, { mergeConfig }) => {
            return mergeConfig(config, {
              devtool: 'eval',
            });
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('eval');
  });

  it('should allow using tools.bundlerChain to modify config', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          bundlerChain(chain) {
            chain.devtool('eval');
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('eval');
  });

  it('should allow tools.bundlerChain to be an array', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          bundlerChain: [
            (chain) => {
              chain.devtool('eval');
            },
            (chain) => {
              chain.devtool('source-map');
            },
          ],
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].devtool).toEqual('source-map');
  });

  it('should expose HtmlWebpackPlugin instance via params', async () => {
    await createRsbuild({
      config: {
        tools: {
          rspack(_config, utils) {
            expect(utils.HtmlPlugin.version).toEqual(5);
          },
        },
      },
    });
  });

  it('should allow append and prepend plugins', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack(_config, utils) {
            utils.appendPlugins([new utils.rspack.DefinePlugin({ foo: '1' })]);
            utils.prependPlugins([new utils.rspack.BannerPlugin({ banner: 'hello' })]);
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    const plugins = config[0].plugins || [];
    expect(plugins.length).toBeGreaterThan(2);
    expect((plugins[0] as RspackPluginInstance).name).toEqual('BannerPlugin');
    expect((plugins[plugins.length - 1] as RspackPluginInstance).name).toEqual('DefinePlugin');
  });

  it('should allow removing plugins', async () => {
    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack(_config, utils) {
            utils.appendPlugins([new utils.rspack.DefinePlugin({ foo: '1' })]);
            utils.prependPlugins([new utils.rspack.DefinePlugin({ foo: '2' })]);
            utils.removePlugin('DefinePlugin');
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'DefinePlugin')).toBeFalsy();
  });

  it('should allow adding rules', async () => {
    const newRule = {
      test: /\.foo$/,
      loader: 'foo-loader',
    };

    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack(_config, utils) {
            utils.addRules(newRule);
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].module?.rules?.includes(newRule)).toBeTruthy();
  });

  test('should merge plugins as expected when using appendPlugins', async () => {
    const config1 = defineConfig({
      tools: {
        rspack: {
          plugins: [new rspack.BannerPlugin({ banner: 'foo' })],
        },
      },
    });

    const config2 = defineConfig({
      tools: {
        rspack(_config, { appendPlugins }) {
          appendPlugins(new rspack.IgnorePlugin({ resourceRegExp: /\.foo$/ }));
        },
      },
    });

    const config3 = defineConfig({
      tools: {
        rspack: {
          plugins: [new rspack.HtmlRspackPlugin()],
        },
      },
    });

    const mergedConfig = mergeRsbuildConfig(config1, config2, config3);

    const rsbuildInstance = await createRsbuild({
      config: mergedConfig,
    });
    const config = await rsbuildInstance.initConfigs();
    const plugins = config[0].plugins || [];

    expect((plugins.pop() as RspackPluginInstance).name).toEqual('HtmlRspackPlugin');
    expect((plugins.pop() as RspackPluginInstance).name).toEqual('IgnorePlugin');
    expect((plugins.pop() as RspackPluginInstance).name).toEqual('BannerPlugin');
  });

  test('should merge rules as expected when using appendRules', async () => {
    const fooRule = {
      test: /\.foo/,
      use: 'foo-loader',
    };
    const barRule = {
      test: /\.bar/,
      use: 'bar-loader',
    };
    const bazRule = {
      test: /\.baz/,
      use: 'baz-loader',
    };

    const config1 = defineConfig({
      tools: {
        rspack: (config) => {
          return {
            ...config,
            module: {
              ...config.module,
              rules: [...(config.module?.rules || []), fooRule],
            },
          };
        },
      },
    });

    const config2 = defineConfig({
      tools: {
        rspack: {
          module: {
            rules: [barRule],
          },
        },
      },
    });

    const config3 = defineConfig({
      tools: {
        rspack: (config, { appendRules }) => {
          appendRules(bazRule);
          return config;
        },
      },
    });

    const mergedConfig = mergeRsbuildConfig(config1, config2, config3);

    const rsbuildInstance = await createRsbuild({
      config: mergedConfig,
    });
    const config = await rsbuildInstance.initConfigs();
    const rules = config[0].module?.rules || [];
    expect(rules.slice(-3)).toEqual([fooRule, barRule, bazRule]);
  });
});
