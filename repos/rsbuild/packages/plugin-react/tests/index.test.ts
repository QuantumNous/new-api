import { createRsbuild } from '@rsbuild/core';
import { createRsbuild as createRsbuildV1 } from '@rsbuild/core-v1';
import { matchPlugin, matchRules } from '@scripts/test-helper';
import { pluginReact } from '../src';

describe('plugins/react', () => {
  it('should work with swc-loader', async () => {
    const rsbuild = await createRsbuild({
      config: {
        mode: 'development',
      },
    });

    rsbuild.addPlugins([pluginReact()]);
    const config = await rsbuild.initConfigs();

    expect(matchRules(config[0], 'a.js')).toMatchSnapshot();
  });

  it('should configuring `tools.swc` to override react runtime', async () => {
    const rsbuild = await createRsbuild({
      config: {
        mode: 'development',
        tools: {
          swc: {
            jsc: {
              transform: {
                react: {
                  runtime: 'classic',
                },
              },
            },
          },
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);
    const config = await rsbuild.initConfigs();

    expect(matchRules(config[0], 'a.js')).toMatchSnapshot();
  });

  it('should set `parser.javascript.jsx` to `true` when using `preserve` react runtime', async () => {
    const rsbuild = await createRsbuild();

    rsbuild.addPlugins([
      pluginReact({
        swcReactOptions: {
          runtime: 'preserve',
        },
      }),
    ]);
    const config = await rsbuild.initConfigs();
    expect(config[0].module?.parser?.javascript).toMatchSnapshot();
  });

  it('should not apply react refresh when dev.hmr is false', async () => {
    const rsbuild = await createRsbuild({
      config: {
        dev: {
          hmr: false,
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);
    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'ReactRefreshRspackPlugin')).toBeFalsy();
  });

  it('should set transpilation scope for react refresh plugin correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        mode: 'development',
        source: {
          include: [/foo/, /bar/],
          exclude: [/baz/],
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'ReactRefreshRspackPlugin')).toMatchSnapshot();
  });

  it('should not apply react refresh when target is node', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'node',
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'ReactRefreshRspackPlugin')).toBeFalsy();
  });

  it('should not apply react refresh when target is web-worker', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'web-worker',
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();
    expect(matchPlugin(config[0], 'ReactRefreshRspackPlugin')).toBeFalsy();
  });

  it('should throw an error when using Rsbuild v1', async () => {
    const rsbuild = await createRsbuildV1({
      config: {
        plugins: [pluginReact()],
      },
    });

    await expect(() => rsbuild.initConfigs()).rejects.toThrow(
      /"@rsbuild\/plugin-react" v2 requires "@rsbuild\/core" >= 2\.0\. Please upgrade "@rsbuild\/core" or use "@rsbuild\/plugin-react" v1\./,
    );
  });

  it('should not apply splitChunks rule when strategy is not split-by-experience', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {
          chunkSplit: {
            strategy: 'single-vendor',
          },
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toMatchSnapshot();
  });

  it('should allow to custom jsxImportSource', async () => {
    const rsbuild = await createRsbuild();

    rsbuild.addPlugins([
      pluginReact({
        swcReactOptions: {
          importSource: '@emotion/react',
        },
      }),
    ]);
    const config = await rsbuild.initConfigs();
    expect(JSON.stringify(config[0])).toContain(`"importSource":"@emotion/react"`);
  });

  it('should allow to enable react compiler', async () => {
    const rsbuild = await createRsbuild();

    rsbuild.addPlugins([
      pluginReact({
        reactCompiler: true,
      }),
    ]);
    const config = await rsbuild.initConfigs();

    expect(JSON.stringify(matchRules(config[0], 'a.tsx'))).toContain(`"reactCompiler":true`);
  });

  it('should allow to configure react compiler', async () => {
    const rsbuild = await createRsbuild();

    rsbuild.addPlugins([
      pluginReact({
        reactCompiler: {
          target: '18',
        },
      }),
    ]);
    const config = await rsbuild.initConfigs();

    expect(JSON.stringify(matchRules(config[0], 'a.tsx'))).toContain(
      `"reactCompiler":{"target":"18"}`,
    );
  });

  it('should allow to add react plugin as single environment plugin', async () => {
    rs.stubEnv('NODE_ENV', 'production');

    const rsbuild = await createRsbuild({
      config: {
        environments: {
          web: {},
          web1: {},
        },
      },
    });

    rsbuild.addPlugins(
      [
        pluginReact({
          enableProfiler: true,
        }),
      ],
      {
        environment: 'web',
      },
    );
    const { bundlerConfigs, environmentConfigs } = await rsbuild.inspectConfig();

    expect(bundlerConfigs[0]).toContain('lib-react');
    expect(environmentConfigs[0]).toContain('keep_classnames');

    expect(bundlerConfigs[1]).not.toContain('lib-react');
    expect(environmentConfigs[1]).not.toContain('keep_classnames');
  });
});
