import { join } from 'node:path';
import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild, type RsbuildPlugin } from '../src';

describe('environment config', () => {
  it('should normalize context correctly', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const cwd = process.cwd();
    const rsbuild = await createRsbuild({
      cwd,
      config: {
        environments: {
          ssr: {
            output: {
              target: 'node',
              distPath: {
                root: 'dist1/server',
              },
            },
          },
          web: {
            output: {
              distPath: {
                root: 'dist1',
              },
            },
          },
        },
      },
    });

    await rsbuild.initConfigs();

    expect(rsbuild.context.distPath).toBe(join(cwd, 'dist1'));
  });

  it('should support modifying environment config by api.modifyRsbuildConfig', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        resolve: {
          alias: {
            '@common': './src/common',
          },
        },
        environments: {
          web: {
            source: {
              entry: {
                index: './src/index.client.js',
              },
            },
          },
          ssr: {
            source: {
              entry: {
                index: './src/index.server.js',
              },
            },
          },
        },
      },
    });

    rsbuild.addPlugins([
      {
        name: 'test-environment',
        setup(api) {
          api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
            return mergeRsbuildConfig(config, {
              environments: {
                web: {
                  resolve: {
                    alias: {
                      '@common1': './src/common1',
                    },
                  },
                },
                web1: {
                  resolve: {
                    alias: {
                      '@common1': './src/common1',
                    },
                  },
                },
              },
            });
          });
        },
      },
    ]);

    const {
      origin: { environmentConfigs },
    } = await rsbuild.inspectConfig();

    expect(environmentConfigs).toMatchSnapshot();
  });

  it('should support modifying single environment config by api.modifyEnvironmentConfig', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        resolve: {
          alias: {
            '@common': './src/common',
          },
        },
        environments: {
          web: {
            source: {
              entry: {
                index: './src/index.client.js',
              },
            },
          },
          ssr: {
            source: {
              entry: {
                index: './src/index.server.js',
              },
            },
          },
        },
      },
    });

    rsbuild.addPlugins([
      {
        name: 'test-environment',
        setup(api) {
          api.modifyEnvironmentConfig((config, { name, mergeEnvironmentConfig }) => {
            if (name !== 'web') {
              return config;
            }

            return mergeEnvironmentConfig(config, {
              resolve: {
                alias: {
                  '@common1': './src/common1',
                },
              },
            });
          });
        },
      },
    ]);

    const {
      origin: { environmentConfigs },
    } = await rsbuild.inspectConfig();

    expect(environmentConfigs).toMatchSnapshot();
  });

  it('should support adding a single environment plugin', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const plugin: (pluginId: string) => RsbuildPlugin = (pluginId) => ({
      name: 'test-environment',
      setup(api) {
        api.modifyEnvironmentConfig((config, { name, mergeEnvironmentConfig }) => {
          return mergeEnvironmentConfig(config, {
            resolve: {
              alias: {
                [pluginId]: name,
              },
            },
          });
        });
      },
    });
    const rsbuild = await createRsbuild({
      config: {
        environments: {
          web: {
            plugins: [plugin('web')],
          },
          ssr: {
            plugins: [plugin('ssr')],
          },
        },
      },
    });

    rsbuild.addPlugins([plugin('global')]);

    const {
      origin: { environmentConfigs },
    } = await rsbuild.inspectConfig();

    expect(
      Object.fromEntries(
        Object.entries(environmentConfigs).map(([name, config]) => [name, config.resolve.alias]),
      ),
    ).toMatchSnapshot();
  });

  it('should support running the specified environment', async () => {
    rs.stubEnv('NODE_ENV', 'development');

    const pluginLogs: string[] = [];

    const plugin: (pluginId: string) => RsbuildPlugin = (pluginId) => ({
      name: 'test-environment',
      setup: () => {
        pluginLogs.push(`run plugin in ${pluginId}`);
      },
    });

    const rsbuild = await createRsbuild({
      config: {
        environments: {
          web: {
            plugins: [plugin('web')],
          },
          ssr: {
            plugins: [plugin('ssr')],
          },
        },
      },
      environment: ['ssr'],
    });

    rsbuild.addPlugins([plugin('global')]);

    const {
      origin: { environmentConfigs },
    } = await rsbuild.inspectConfig();

    expect(Object.keys(environmentConfigs)).toEqual(['ssr']);
    expect(pluginLogs).toEqual(['run plugin in ssr', 'run plugin in global']);
  });

  it('should normalize environment config correctly', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        resolve: {
          alias: {
            '@common': './src/common',
          },
        },
        dev: {
          lazyCompilation: false,
        },
        environments: {
          web: {
            source: {
              entry: {
                index: './src/index.client.js',
              },
            },
            dev: {
              lazyCompilation: true,
            },
          },
          ssr: {
            output: {
              target: 'node',
            },
            dev: {
              assetPrefix: '/foo',
            },
            source: {
              entry: {
                index: './src/index.server.js',
              },
            },
          },
        },
      },
    });

    await rsbuild.initConfigs();

    expect(
      rsbuild.getNormalizedConfig({
        environment: 'web',
      }),
    ).toMatchSnapshot();

    expect(
      rsbuild.getNormalizedConfig({
        environment: 'ssr',
      }),
    ).toMatchSnapshot();
  });

  it('should print environment config when inspecting config', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        resolve: {
          alias: {
            '@common': './src/common',
          },
        },
        environments: {
          web: {
            source: {
              entry: {
                index: './src/index.client.js',
              },
            },
          },
          ssr: {
            source: {
              entry: {
                index: './src/index.server.js',
              },
            },
          },
        },
      },
    });

    const {
      origin: { environmentConfigs },
    } = await rsbuild.inspectConfig();

    expect(environmentConfigs).toMatchSnapshot();
  });

  it('should allow configuring tools.rspack and bundlerChain in environment config', async () => {
    rs.stubEnv('NODE_ENV', 'development');
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
        environments: {
          web: {
            tools: {
              rspack(config) {
                return {
                  ...config,
                  devtool: 'eval-source-map',
                };
              },
            },
          },
          node: {
            output: {
              target: 'node',
            },
            tools: {
              bundlerChain: (chain) => {
                chain.output.filename('bundle.js');
              },
            },
          },
        },
      },
    });

    const configs = await rsbuild.initConfigs();
    expect(configs).toMatchSnapshot();
  });

  it('should allow configuring dev.hmr in environment config', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        environments: {
          web: {
            dev: {
              hmr: false,
            },
          },
          web2: {
            dev: {
              hmr: true,
            },
          },
        },
      },
    });

    const configs = await rsbuild.initConfigs();

    expect(matchPlugin(configs[0], 'HotModuleReplacementPlugin')).toBeFalsy();
    expect(matchPlugin(configs[1], 'HotModuleReplacementPlugin')).toBeTruthy();
  });

  it('should skip lazy compilation when environment disables hmr and liveReload', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        dev: {
          lazyCompilation: true,
        },
        environments: {
          web: {
            dev: {
              hmr: false,
              liveReload: false,
            },
          },
          web2: {
            dev: {
              hmr: false,
              liveReload: true,
            },
          },
        },
      },
    });

    const configs = await rsbuild.initConfigs({ action: 'dev' });

    expect(configs[0].lazyCompilation).toBeFalsy();
    expect(configs[1].lazyCompilation).toBeTruthy();
  });

  it('should expose APIs by environment', async () => {
    const logs: string[] = [];
    const createConsumerPlugin = (name: string): RsbuildPlugin => ({
      name: `${name}-consumer`,
      setup(api) {
        logs.push(`${name}: ${api.useExposed('test-api')}`);
      },
    });

    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          {
            name: 'global-provider',
            setup(api) {
              api.expose('test-api', 'global');
            },
          },
          createConsumerPlugin('global'),
        ],
        environments: {
          web: {
            plugins: [
              {
                name: 'web-provider',
                setup(api) {
                  api.expose('test-api', 'web', { environment: 'web' });
                },
              },
              createConsumerPlugin('web'),
            ],
          },
          node: {
            plugins: [createConsumerPlugin('node')],
          },
        },
      },
    });

    await rsbuild.initConfigs();

    expect(logs).toEqual(['global: global', 'web: web', 'node: global']);
  });
});
