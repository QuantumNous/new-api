import { logger, type InternalContext, type RsbuildPluginAPI } from '../src';
import { createPluginManager, initPlugins } from '../src/pluginManager';

describe('initPlugins', () => {
  it('should sort plugins correctly', async () => {
    const pluginManager = createPluginManager(logger);
    const result: number[] = [];

    pluginManager.addPlugins([
      {
        name: 'plugin0',
        setup() {
          result.push(0);
        },
      },
      {
        name: 'plugin1',
        pre: ['plugin3'],
        setup() {
          result.push(1);
        },
      },
      {
        name: 'plugin2',
        post: ['plugin0'],
        setup() {
          result.push(2);
        },
      },
      {
        name: 'plugin3',
        setup() {
          result.push(3);
        },
      },
    ]);

    await initPlugins({
      pluginManager,
      context: {
        logger,
        getPluginAPI: () => ({}) as RsbuildPluginAPI,
      } as InternalContext,
    });

    expect(result).toEqual([2, 0, 3, 1]);
  });

  it('should allow removing plugins', async () => {
    const pluginManager = createPluginManager(logger);
    const result: number[] = [];

    pluginManager.addPlugins([
      {
        name: 'plugin0',
        setup() {
          result.push(0);
        },
      },
      {
        name: 'plugin1',
        setup() {
          result.push(1);
        },
      },
      {
        name: 'plugin2',
        remove: ['plugin1'],
        setup() {
          result.push(2);
        },
      },
    ]);

    await initPlugins({
      pluginManager,
      context: {
        logger,
        getPluginAPI: () => ({}) as RsbuildPluginAPI,
      } as InternalContext,
    });

    expect(result).toEqual([0, 2]);
  });

  it('should remove environment plugin correctly', async () => {
    const pluginManager = createPluginManager(logger);
    const result: number[] = [];

    pluginManager.addPlugins(
      [
        {
          name: 'plugin0',
          // environment plugin can't remove global plugin
          remove: ['plugin2', 'plugin3'],
          setup() {
            result.push(0);
          },
        },
        {
          name: 'plugin1',
          setup() {
            result.push(1);
          },
        },
        {
          name: 'plugin3',
          setup() {
            result.push(3);
          },
        },
      ],
      {
        environment: 'A',
      },
    );

    pluginManager.addPlugins([
      {
        name: 'plugin2',
        // global plugin can remove environment plugin
        remove: ['plugin1'],
        setup() {
          result.push(2);
        },
      },
    ]);

    await initPlugins({
      pluginManager,
      context: {
        logger,
        getPluginAPI: () => ({}) as RsbuildPluginAPI,
      } as InternalContext,
    });

    expect(result).toEqual([0, 2]);
  });
});

describe('plugin manager', () => {
  it('should add, remove, and get environment-specific plugins correctly', async () => {
    const pluginManager = createPluginManager(logger);

    pluginManager.addPlugins([
      {
        name: 'plugin0',
        setup() {},
      },
      {
        name: 'plugin1',
        setup() {},
      },
      {
        name: 'plugin2',
        setup() {},
      },
      {
        name: 'plugin3',
        setup() {},
      },
    ]);

    pluginManager.addPlugins(
      [
        // Repeat registry
        {
          name: 'plugin1',
          setup() {},
        },
        {
          name: 'plugin5',
          setup() {},
        },
      ],
      { environment: 'b' },
    );

    pluginManager.removePlugins(['plugin3']);

    expect(pluginManager.isPluginExists('plugin3')).toBeFalsy();
    expect(pluginManager.isPluginExists('plugin5')).toBeFalsy();
    expect(
      pluginManager.isPluginExists('plugin5', {
        environment: 'b',
      }),
    ).toBeTruthy();

    expect(pluginManager.getPlugins().map((p) => p.name)).toEqual([
      'plugin0',
      'plugin1',
      'plugin2',
    ]);

    expect(pluginManager.getPlugins({ environment: 'a' }).map((p) => p.name)).toEqual([
      'plugin0',
      'plugin1',
      'plugin2',
    ]);

    expect(pluginManager.getPlugins({ environment: 'b' }).map((p) => p.name)).toEqual([
      'plugin0',
      'plugin1',
      'plugin2',
      'plugin1',
      'plugin5',
    ]);

    pluginManager.removePlugins(['plugin1'], { environment: 'b' });

    // should remove environment's plugin1 and keep global plugin1
    expect(pluginManager.getPlugins({ environment: 'b' }).map((p) => p.name)).toEqual([
      'plugin0',
      'plugin1',
      'plugin2',
      'plugin5',
    ]);
  });
});
