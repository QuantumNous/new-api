import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild, type HtmlConfig } from '../src';

describe('plugin-html', () => {
  const defaultEntryConfig = {
    source: {
      entry: {
        index: './src/index.js',
      },
    },
  };

  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should register html plugin correctly', async () => {
    const rsbuild = await createRsbuild({
      config: defaultEntryConfig,
    });
    const config = (await rsbuild.initConfigs())[0];

    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });

  it('should not register html plugin when target is node', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        output: {
          target: 'node',
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'HtmlRspackPlugin')).toBeFalsy();
  });

  it('should not register html plugin when target is web-worker', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        output: {
          target: 'web-worker',
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'HtmlRspackPlugin')).toBeFalsy();
  });

  it('should allow setting favicon by html.favicon option', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        html: {
          favicon: './src/favicon.ico',
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];

    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });

  it('should allow setting inject by html.inject option', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        html: {
          inject: 'body',
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];

    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });

  it('should enable minify in production', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: defaultEntryConfig,
    });
    const config = (await rsbuild.initConfigs())[0];

    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });

  it('should allow modifying plugin options via tools.htmlPlugin', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        tools: {
          htmlPlugin(_config, utils) {
            expect(utils.entryName).toEqual('index');
            return {
              inject: true,
            };
          },
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];

    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });

  it('should allow disabling html plugin', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        tools: {
          htmlPlugin: false,
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'HtmlRspackPlugin')).toBeFalsy();
  });

  it('should support multiple entries', async () => {
    const rsbuild = await createRsbuild({
      config: {
        source: {
          entry: {
            main: './src/main.ts',
            foo: './src/foo.ts',
          },
        },
        html: {
          template({ entryName }) {
            expect(['main', 'foo'].includes(entryName)).toBeTruthy();
          },
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];

    const htmlPluginCount = config.plugins?.filter(
      (item) => item?.constructor.name === 'HtmlRspackPlugin',
    ).length;
    expect(htmlPluginCount).toEqual(2);
    expect(matchPlugin(config, 'HtmlRspackPlugin', true)).toMatchSnapshot();
  });

  it('should allow configuring html.tags', async () => {
    const rsbuild = await createRsbuild({
      config: {
        source: {
          entry: {
            main: './src/main.ts',
            foo: './src/foo.ts',
          },
        },
        html: {
          tags: [{ tag: 'script', attrs: { src: 'jq.js' } }],
        },
      },
    });
    const config = (await rsbuild.initConfigs())[0];
    const htmlPluginCount = config.plugins?.filter(
      (item) => item?.constructor.name === 'HtmlRspackPlugin',
    ).length;
    expect(htmlPluginCount).toEqual(2);
    expect(matchPlugin(config, 'HtmlRspackPlugin', true)).toMatchSnapshot();
  });

  it('should support environment-specific HTML config', async () => {
    const rsbuild = await createRsbuild({
      config: {
        environments: {
          web: {
            source: {
              entry: {
                main: './src/main.ts',
              },
            },
            html: {
              mountId: 'app',
              title: 'web',
            },
            output: {
              distPath: {
                html: 'web',
              },
            },
          },
          web1: {
            source: {
              entry: {
                index: './src/main1.ts',
              },
            },
            html: {
              mountId: 'app1',
              title: 'web1',
            },
          },
        },
      },
    });
    const configs = await rsbuild.initConfigs();

    expect(configs.map((config) => matchPlugin(config, 'HtmlRspackPlugin'))).toMatchSnapshot();
  });

  it.each<{ value: HtmlConfig['inject']; message: string }>([
    { value: false, message: 'false' },
    { value: () => false, message: '() => false' },
  ])('should stop injecting script tag if inject is $message', async ({ value }) => {
    const rsbuild = await createRsbuild({
      config: {
        ...defaultEntryConfig,
        html: { inject: value },
      },
    });
    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'HtmlRspackPlugin')).toMatchSnapshot();
  });
});
