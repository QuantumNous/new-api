import { createRsbuild } from '../src';

describe('default bundler', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should use Rspack by default', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0]).toMatchSnapshot();
  });
});

describe('plugins', () => {
  it('should apply nested plugins correctly', async () => {
    function myPlugin() {
      return [
        {
          name: 'plugin-foo',
          setup() {},
        },
        {
          name: 'plugin-bar',
          setup() {},
        },
      ];
    }

    const rsbuild = await createRsbuild({
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
        plugins: [
          myPlugin(),
          Promise.resolve([
            {
              name: 'plugin-zoo',
              setup() {},
            },
          ]),
        ],
      },
    });

    expect(rsbuild.isPluginExists('plugin-foo')).toBeTruthy();
    expect(rsbuild.isPluginExists('plugin-bar')).toBeTruthy();
    expect(rsbuild.isPluginExists('plugin-zoo')).toBeTruthy();
    expect(rsbuild.isPluginExists('plugin-404')).toBeFalsy();
  });
});
