import { createRsbuild } from '../src';

describe('pluginApply', () => {
  it('should apply plugin correctly', async () => {
    const setup = rstest.fn();

    const rsbuild = await createRsbuild();
    rsbuild.addPlugins([
      {
        name: 'plugin-test',
        apply: 'build',
        setup,
      },
      {
        name: 'plugin-test2',
        setup,
      },
      {
        name: 'plugin-test3',
        apply(config, { action }) {
          return config.mode === 'development' || action === 'build' || action === 'dev';
        },
        setup,
      },
    ]);

    await rsbuild.initConfigs();

    expect(setup).toHaveBeenCalledTimes(3);
  });

  it('should apply plugin correctly with action', async () => {
    const setup = rstest.fn();

    const rsbuild = await createRsbuild();
    rsbuild.addPlugins([
      {
        name: 'plugin-test',
        apply: 'build',
        setup() {
          expect.fail('should not apply this plugin');
        },
      },
      {
        name: 'plugin-test2',
        apply: 'serve',
        setup,
      },
      {
        name: 'plugin-test3',
        apply(_, { action }) {
          return action === 'preview';
        },
        setup,
      },
    ]);

    await rsbuild.initConfigs({
      action: 'dev',
    });

    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('should not return the same config when called multiple times', async () => {
    const setup = rstest.fn();
    const rsbuild = await createRsbuild();
    rsbuild.addPlugins([
      {
        name: 'plugin-test',
        apply: 'build',
        setup() {
          expect.fail('should not apply this plugin');
        },
      },
      {
        name: 'plugin-test2',
        apply: 'serve',
        setup,
      },
    ]);

    const [config1] = await rsbuild.initConfigs({
      action: 'dev',
    });

    expect(setup).toHaveBeenCalledTimes(1);

    const [config2] = await rsbuild.initConfigs();

    expect(setup).toHaveBeenCalledTimes(1);
    expect(config1).not.toBe(config2);

    const [config3] = await rsbuild.initConfigs({
      action: 'dev',
    });

    expect(setup).toHaveBeenCalledTimes(1);
    expect(config2).not.toBe(config3);
  });

  it('should throw an error when called with different action type', async () => {
    const rsbuild = await createRsbuild();
    rsbuild.addPlugins([
      {
        name: 'plugin-test',
        apply: 'build',
        setup() {
          expect.fail('should not apply this plugin');
        },
      },
    ]);

    await rsbuild.initConfigs({ action: 'dev' });

    await expect(() => rsbuild.initConfigs({ action: 'build' })).rejects.toThrow(
      `[rsbuild] initConfigs() can only be called with the same action type.
  - Expected: dev
  - Actual: build`,
    );
  });
});
