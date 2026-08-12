import { createRsbuild } from '../src';

describe('plugin-minimize', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should not apply minimizer in development', async () => {
    rs.stubEnv('NODE_ENV', 'development');

    const rsbuild = await createRsbuild();

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimizer).toBeUndefined();
  });

  it('should apply minimizer in production', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild();

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimizer).toMatchSnapshot();
  });

  it('should not apply minimizer for JS when output.minify.js is false', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          minify: {
            js: false,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimizer?.length).toBe(1);
    expect(rspackConfigs[0].optimization?.minimizer?.[0]).toMatchObject({
      name: 'LightningCssMinimizerRspackPlugin',
    });
  });

  it('should not minimize when both output.minify.js and output.minify.css are false', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          minify: {
            css: false,
            js: false,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimize).toBe(false);
  });

  it('should not apply minimizer for CSS when output.minify.css is false', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          minify: {
            css: false,
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimizer?.length).toBe(1);
    expect(rspackConfigs[0].optimization?.minimizer?.[0]).toMatchObject({
      name: 'SwcJsMinimizerRspackPlugin',
    });
  });

  it('should accept and merge options for JS minimizer', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          minify: {
            jsOptions: {
              exclude: 'no_js_minify',
            },
          },
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    // implicit assert the order of minimizers here,
    // could also be a guard for the order of minimizers
    expect(rspackConfigs[0].optimization?.minimizer?.[0]).toMatchObject({
      _args: [
        {
          exclude: 'no_js_minify',
        },
      ],
    });
  });

  it('should dropConsole when performance.removeConsole is true', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        performance: {
          removeConsole: true,
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(rspackConfigs[0].optimization?.minimizer).toMatchSnapshot();
  });

  it('should remove specific console when performance.removeConsole is array', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        performance: {
          removeConsole: ['log', 'warn'],
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].optimization?.minimizer).toMatchSnapshot();
  });

  it('should set asciiOnly false when output.charset is utf8', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        output: {
          charset: 'utf8',
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(rspackConfigs[0].optimization?.minimizer).toMatchSnapshot();
  });
});
