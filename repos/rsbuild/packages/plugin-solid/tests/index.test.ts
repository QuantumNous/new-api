import { createRsbuild, type RsbuildConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { matchRules } from '@scripts/test-helper';
import { pluginSolid } from '../src';

describe('plugin-solid', () => {
  const rsbuildConfig: RsbuildConfig = {
    performance: {
      buildCache: false,
    },
  };

  it('should apply solid preset correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [pluginSolid(), pluginBabel()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.tsx')[0]).toMatchSnapshot();
  });

  it('should add solid resolve condition', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [pluginSolid()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', '...']);
  });

  it('should add development resolve condition in development mode', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        mode: 'development',
        plugins: [pluginSolid()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', 'development', '...']);
  });

  it('should preserve user resolve condition names', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        mode: 'development',
        resolve: {
          conditionNames: ['custom', 'import'],
        },
        plugins: [pluginSolid()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', 'development', 'custom', 'import']);
  });

  it('should allow disabling solid development condition', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        mode: 'development',
        plugins: [pluginSolid({ dev: false })],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', '...']);
  });

  it('should not add development condition in production mode by default', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        mode: 'production',
        plugins: [pluginSolid()],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', '...']);
  });

  it('should allow forcing solid development condition in production mode', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        mode: 'production',
        plugins: [pluginSolid({ dev: true })],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(config[0].resolve?.conditionNames).toEqual(['solid', 'development', '...']);
  });

  it('should allow disabling solid refresh via refresh.disabled', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [pluginSolid({ refresh: { disabled: true } }), pluginBabel()],
      },
    });
    const config = await rsbuild.initConfigs();

    expect(JSON.stringify(matchRules(config[0], 'a.tsx')[0]).includes('solid-refresh')).toEqual(
      false,
    );
  });

  it('should use hydratable dom output for ssr option on web target', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [pluginSolid({ ssr: true }), pluginBabel()],
      },
    });
    const config = await rsbuild.initConfigs();
    const rule = matchRules(config[0], 'a.tsx')[0];
    expect(rule).toMatchSnapshot();
  });

  it('should use ssr output for ssr option on node target', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        output: {
          target: 'node',
        },
        plugins: [pluginSolid({ ssr: true }), pluginBabel()],
      },
    });
    const config = await rsbuild.initConfigs();
    const rule = matchRules(config[0], 'a.tsx')[0];
    expect(rule).toMatchSnapshot();
  });

  it('should allow solid options to override ssr defaults', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        output: {
          target: 'node',
        },
        plugins: [
          pluginSolid({
            ssr: true,
            solid: {
              generate: 'universal',
              hydratable: false,
            },
          }),
          pluginBabel(),
        ],
      },
    });
    const config = await rsbuild.initConfigs();
    const rule = matchRules(config[0], 'a.tsx')[0];
    expect(rule).toMatchSnapshot();
  });

  it('should allow to configure solid options', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [
          pluginSolid({
            solid: {
              generate: 'ssr',
              hydratable: true,
            },
          }),
          pluginBabel(),
        ],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.tsx')[0]).toMatchSnapshot();
  });

  it('should allow deprecated solidPresetOptions alias', async () => {
    const rsbuild = await createRsbuild({
      config: {
        ...rsbuildConfig,
        plugins: [
          pluginSolid({
            solidPresetOptions: {
              generate: 'ssr',
              hydratable: true,
            },
          }),
          pluginBabel(),
        ],
      },
    });
    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.tsx')[0]).toMatchSnapshot();
  });
});
