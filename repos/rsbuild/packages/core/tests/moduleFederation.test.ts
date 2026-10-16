import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild } from '../src';

describe('plugin-module-federation', () => {
  it('should set module federation config', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {
          chunkSplit: {
            strategy: 'split-by-experience',
          },
        },
        moduleFederation: {
          options: {
            name: 'remote',
            exposes: {
              './Button': './src/Button',
            },
            filename: 'remoteEntry.js',
            shared: {
              react: {
                singleton: true,
                requiredVersion: '^19.0.0',
              },
              'react-dom': {
                singleton: true,
                requiredVersion: '^19.0.0',
              },
            },
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'ModuleFederationPlugin')).toMatchSnapshot();
  });

  it('should set environment module federation config correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {
          chunkSplit: {
            strategy: 'split-by-experience',
          },
        },
        environments: {
          web: {
            moduleFederation: {
              options: {
                name: 'remote',
                exposes: {
                  './Button': './src/Button',
                },
                filename: 'remoteEntry.js',
                shared: {
                  react: {
                    singleton: true,
                    requiredVersion: '^19.0.0',
                  },
                  'react-dom': {
                    singleton: true,
                    requiredVersion: '^19.0.0',
                  },
                },
              },
            },
          },
          web1: {},
        },
      },
    });

    const configs = await rsbuild.initConfigs();
    expect(
      configs.map((config) => matchPlugin(config, 'ModuleFederationPlugin')),
    ).toMatchSnapshot();
  });

  it('should set module federation and environment chunkSplit config correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        moduleFederation: {
          options: {
            name: 'remote',
            exposes: {
              './Button': './src/Button',
            },
            filename: 'remoteEntry.js',
            shared: {
              react: {
                singleton: true,
                requiredVersion: '^19.0.0',
              },
              'react-dom': {
                singleton: true,
                requiredVersion: '^19.0.0',
              },
            },
          },
        },
        environments: {
          web: {
            performance: {
              chunkSplit: {
                strategy: 'split-by-experience',
              },
            },
          },
          web1: {
            performance: {
              chunkSplit: {
                strategy: 'all-in-one',
              },
            },
          },
        },
      },
    });

    const configs = await rsbuild.initConfigs();
    expect(
      configs.map((config) => matchPlugin(config, 'ModuleFederationPlugin')),
    ).toMatchSnapshot();
  });
});
