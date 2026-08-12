import { matchRules } from '@scripts/test-helper';
import { createRsbuild } from '../src';
import { normalizeCssLoaderOptions } from '../src/plugins/css';

describe('normalizeCssLoaderOptions', () => {
  it('should enable exportOnlyLocals correctly', () => {
    expect(normalizeCssLoaderOptions({ modules: false }, true)).toEqual({
      modules: false,
    });

    expect(normalizeCssLoaderOptions({ modules: true }, true)).toEqual({
      modules: {
        exportOnlyLocals: true,
      },
    });

    expect(normalizeCssLoaderOptions({ modules: true }, false)).toEqual({
      modules: true,
    });

    expect(normalizeCssLoaderOptions({ modules: 'local' }, true)).toEqual({
      modules: {
        mode: 'local',
        exportOnlyLocals: true,
      },
    });

    expect(normalizeCssLoaderOptions({ modules: { auto: true } }, true)).toEqual({
      modules: {
        auto: true,
        exportOnlyLocals: true,
      },
    });
  });
});

describe('plugin-css', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should enable source map when output.sourceMap.css is true', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          sourceMap: {
            css: true,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(JSON.stringify(rspackConfigs[0])).toContain('"sourceMap":true');
  });

  it('should disable source map when output.sourceMap.css is false', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          sourceMap: {
            css: false,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(JSON.stringify(rspackConfigs[0])).toContain('"sourceMap":false');
  });

  it('should disable source map in production by default', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild();

    const rspackConfigs = await rsbuild.initConfigs();

    expect(JSON.stringify(rspackConfigs[0])).toContain('"sourceMap":false');
  });

  it('should allow customizing cssModules.localIdentName', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          cssModules: {
            localIdentName: '[hash]',
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(JSON.stringify(rspackConfigs[0])).toContain('"localIdentName":"[hash]"');
  });

  it('should use custom cssModules rule when using output.cssModules config', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          cssModules: {
            auto: (resourcePath) => resourcePath.includes('.module.'),
          },
        },
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.module.css')).toMatchSnapshot();
  });
});

describe('plugin-css injectStyles', () => {
  it('should use css-loader + style-loader when injectStyles is true', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          injectStyles: true,
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(matchRules(rspackConfigs[0], 'a.css')).toMatchSnapshot();
  });

  it('should apply ignoreCssLoader when injectStyles is true and target is node', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'node',
          injectStyles: true,
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(matchRules(rspackConfigs[0], 'a.css')).toMatchSnapshot();
  });
});

it('should ensure isolation of PostCSS config objects between different builds', async () => {
  const rsbuild = await createRsbuild({
    config: {
      environments: {
        web: {
          tools: {
            postcss(config) {
              config.postcssOptions ||= {};
              if (typeof config.postcssOptions === 'object') {
                config.postcssOptions.plugins = [{ postcssPlugin: 'foo' }];
              }
            },
          },
        },
        web2: {
          tools: {
            postcss(config) {
              config.postcssOptions ||= {};
              if (typeof config.postcssOptions === 'object') {
                config.postcssOptions.plugins = [{ postcssPlugin: 'bar' }];
              }
            },
          },
        },
      },
    },
  });

  const rspackConfigs = await rsbuild.initConfigs();
  expect(matchRules(rspackConfigs[0], 'a.css')).toMatchSnapshot();
  expect(matchRules(rspackConfigs[1], 'a.css')).toMatchSnapshot();
});
