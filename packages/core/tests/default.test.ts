import { matchRules } from '@scripts/test-helper';
import { createRsbuild, type RsbuildPlugin } from '../src';

afterEach(() => {
  rs.unstubAllEnvs();
});

it('should apply default plugins correctly', async () => {
  rs.stubEnv('NODE_ENV', 'development');
  const rsbuild = await createRsbuild();

  const rspackConfigs = await rsbuild.initConfigs();
  expect(rspackConfigs[0]).toMatchSnapshot();
});

it('should apply default plugins correctly in production', async () => {
  rs.stubEnv('NODE_ENV', 'production');

  const rsbuild = await createRsbuild();

  const rspackConfigs = await rsbuild.initConfigs();
  expect(rspackConfigs[0]).toMatchSnapshot();
});

it('should apply default plugins correctly when target is node', async () => {
  rs.stubEnv('NODE_ENV', 'test');
  const rsbuild = await createRsbuild({
    config: {
      mode: 'development',
      output: {
        target: 'node',
      },
    },
  });

  const rspackConfigs = await rsbuild.initConfigs();

  expect(rspackConfigs[0]).toMatchSnapshot();
});

describe('tools.rspack', () => {
  it('should match snapshot', async () => {
    rs.stubEnv('NODE_ENV', 'development');

    class TestPlugin {
      readonly name: string = 'TestPlugin';

      apply() {}
    }

    const rsbuild = await createRsbuild({
      config: {
        tools: {
          rspack: (_config, { addRules, prependPlugins, appendRules }) => {
            addRules({
              test: /\.test$/,
              use: [
                {
                  loader: 'builtin:sass-loader',
                },
              ],
            });
            appendRules({
              test: /\.foo/,
              loader: 'foo-loader',
            });

            prependPlugins([new TestPlugin()]);
          },
        },
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0]).toMatchSnapshot();
  });
});

describe('bundler API', () => {
  it('should preserve API order when using modifyBundlerChain', async () => {
    const testPlugin: RsbuildPlugin = {
      name: 'plugin-devtool',
      setup(api) {
        api.modifyBundlerChain((chain) => {
          chain.target('node');
          chain.devtool('cheap-module-source-map');
        });

        api.modifyRspackConfig((config) => {
          config.devtool = 'hidden-source-map';
        });
      },
    };

    const rsbuild = await createRsbuild({
      config: {
        plugins: [testPlugin],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].target).toBe('node');
    expect(rspackConfigs[0].devtool).toBe('hidden-source-map');
  });

  it('should format modifyBundlerChain rules correctly', async () => {
    const testPlugin: RsbuildPlugin = {
      name: 'plugin-devtool',
      setup(api) {
        api.modifyBundlerChain((chain) => {
          chain.module
            .rule('yaml')
            .type('javascript/auto')
            .test(/\.ya?ml$/)
            .use('yaml')
            .loader('yaml-loader');
        });
      },
    };

    const rsbuild = await createRsbuild({
      config: {
        plugins: [testPlugin],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.yaml')).toMatchSnapshot();
  });

  it('should support using builtinLoader in modifyBundlerChain', async () => {
    const testPlugin: RsbuildPlugin = {
      name: 'plugin-test',
      setup(api) {
        api.modifyBundlerChain((chain) => {
          chain.module
            .rule('yaml')
            .type('javascript/auto')
            .test(/\.ya?ml$/)
            .use('yaml')
            .loader('builtin:yaml-loader');
        });
      },
    };

    const rsbuild = await createRsbuild({
      config: {
        plugins: [testPlugin],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.yaml')).toMatchSnapshot();
  });
});

describe('default values', () => {
  it('should apply server.base as the default assetPrefix value', async () => {
    const rsbuild = await createRsbuild({
      config: {
        server: {
          base: '/base',
        },
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.assetPrefix).toBe('/base');
    expect(rsbuildConfig.output.assetPrefix).toBe('/base');
  });

  it('should apply dev and output assetPrefix values correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        server: {
          base: '/base',
        },
        dev: {
          assetPrefix: '/base/aaa',
        },
        output: {
          assetPrefix: '/',
        },
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.assetPrefix).toBe('/base/aaa');
    expect(rsbuildConfig.output.assetPrefix).toBe('/');
  });

  it('should apply root logLevel as the default dev.client.logLevel', async () => {
    const rsbuild = await createRsbuild({
      config: {
        logLevel: 'warn',
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.client.logLevel).toBe('warn');
  });

  it('should apply explicit dev.client.logLevel over root logLevel', async () => {
    const rsbuild = await createRsbuild({
      config: {
        logLevel: 'warn',
        dev: {
          client: {
            logLevel: 'error',
          },
        },
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.client.logLevel).toBe('error');
  });

  it('should default dev.client.logLevel to info', async () => {
    const rsbuild = await createRsbuild();

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.client.logLevel).toBe('info');
  });

  it('should set dev.client.logLevel to silent', async () => {
    const rsbuild = await createRsbuild({
      config: {
        dev: {
          client: {
            logLevel: 'silent',
          },
        },
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.client.logLevel).toBe('silent');
  });

  it('should inherit root logLevel `silent` to dev.client.logLevel', async () => {
    const rsbuild = await createRsbuild({
      config: {
        logLevel: 'silent',
      },
    });

    const {
      origin: { rsbuildConfig },
    } = await rsbuild.inspectConfig();
    expect(rsbuildConfig.dev.client.logLevel).toBe('silent');
  });
});
