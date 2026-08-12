import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild } from '../src';

describe('plugin-output', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should set output correctly', async () => {
    const rsbuild = await createRsbuild();

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output).toMatchSnapshot();
  });

  it('should allow enabling filename hash in development mode', async () => {
    rs.stubEnv('NODE_ENV', 'development');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          filenameHash: {
            enable: 'always',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    const [config] = rspackConfigs;

    expect(config.output).toMatchSnapshot();
    expect(matchPlugin(config, 'CssExtractRspackPlugin')).toMatchObject({
      options: {
        filename: 'static/css/[name].[contenthash:10].css',
        chunkFilename: 'static/css/async/[name].[contenthash:10].css',
      },
    });
  });

  it('should allow customizing filename hash format with object config', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          filenameHash: {
            format: 'contenthash:16',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    const [config] = rspackConfigs;

    expect(config.output).toMatchSnapshot();
    expect(matchPlugin(config, 'CssExtractRspackPlugin')).toMatchObject({
      options: {
        filename: 'static/css/[name].[contenthash:16].css',
        chunkFilename: 'static/css/async/[name].[contenthash:16].css',
      },
    });
  });

  it('should allow disabling filename hash with object config', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          filenameHash: {
            enable: false,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    const [config] = rspackConfigs;

    expect(config.output).toMatchSnapshot();
    expect(matchPlugin(config, 'CssExtractRspackPlugin')).toMatchObject({
      options: {
        filename: 'static/css/[name].css',
        chunkFilename: 'static/css/async/[name].css',
      },
    });
  });

  it('should allow customizing server directory with distPath.root', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'node',
          distPath: {
            root: 'dist/server',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output).toMatchSnapshot();
  });

  it('should allow setting distPath.js and distPath.css to empty string', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          distPath: {
            js: '',
            css: '',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output).toMatchSnapshot();
  });

  it('should allow customizing async js path via distPath.jsAsync', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          distPath: {
            jsAsync: 'custom/js',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output?.chunkFilename).toEqual('custom/js/[name].js');
  });

  it('should allow using filename.js to modify filename', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          filename: {
            js: 'foo.js',
            css: '[name].css',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output).toMatchSnapshot();
  });

  it('should apply output config when target is node', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'node',
          distPath: {
            js: 'bundle',
          },
          filename: {
            js: 'foo.js',
            css: '[name].css',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].output).toMatchSnapshot();
  });

  it('should allow using copy plugin', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          copy: {
            patterns: [
              {
                from: 'test',
              },
            ],
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchPlugin(rspackConfigs[0], 'CopyRspackPlugin')).toMatchSnapshot();
  });

  it('should allow using copy plugin with multiple configurations', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          copy: [
            {
              from: 'test',
            },
            'src/assets/',
          ],
        },
        tools: {
          bundlerChain: (chain, { CHAIN_ID }) => {
            chain.plugin(CHAIN_ID.PLUGIN.COPY).tap((args) => [
              {
                patterns: [...(args[0]?.patterns || []), 'tests/'],
              },
            ]);
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchPlugin(rspackConfigs[0], 'CopyRspackPlugin')).toMatchSnapshot();
  });

  it('should replace `<port>` placeholder with default port', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        dev: {
          assetPrefix: 'http://example-<port>.com:<port>/',
        },
      },
    });

    const [config] = await rsbuild.initConfigs();
    expect(config?.output?.publicPath).toEqual('http://example-3000.com:3000/');
  });

  it('should replace `<port>` placeholder with server.port', async () => {
    rs.stubEnv('NODE_ENV', 'development');
    const rsbuild = await createRsbuild({
      config: {
        server: { port: 4000 },
        dev: {
          assetPrefix: 'http://example-<port>.com:<port>/',
        },
      },
    });
    const [config] = await rsbuild.initConfigs();
    expect(config?.output?.publicPath).toEqual('http://example-4000.com:4000/');
  });

  it('should replace `<port>` placeholder of `output.assetPrefix` with default port', async () => {
    rs.stubEnv('NODE_ENV', 'production');
    const rsbuild = await createRsbuild({
      config: {
        output: {
          assetPrefix: 'http://example.com:<port>/',
        },
      },
    });

    const [config] = await rsbuild.initConfigs();
    expect(config?.output?.publicPath).toEqual('http://example.com:3000/');
  });
});
