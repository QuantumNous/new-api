import { expect, test } from '@e2e/helper';
import { createRsbuild, type RsbuildPlugin } from '@rsbuild/core';

type ParentAPI = {
  initial: number;
  double: (val: number) => number;
};

const parentSymbol = Symbol('parent-api');

const pluginParent: RsbuildPlugin = {
  name: 'plugin-parent',
  setup(api) {
    api.expose<ParentAPI>(parentSymbol, {
      initial: 1,
      double: (val: number) => val * 2,
    });
  },
};

const pluginParent2: RsbuildPlugin = {
  name: 'plugin-parent2',
  setup(api) {
    api.expose<ParentAPI>(parentSymbol, {
      initial: 2,
      double: (val: number) => val * 2,
    });
  },
};

test('should allow plugin to expose and consume API', async () => {
  const pluginChild: RsbuildPlugin = {
    name: 'plugin-child',
    setup(api) {
      const parentAPI = api.useExposed<ParentAPI>(parentSymbol);
      expect(parentAPI?.double(parentAPI.initial)).toEqual(2);
    },
  };

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [pluginParent, pluginChild],
    },
  });
  await rsbuild.build();
});

test('should override the previous exposed API', async () => {
  const pluginChild: RsbuildPlugin = {
    name: 'plugin-child',
    setup(api) {
      const parentAPI = api.useExposed<ParentAPI>(parentSymbol);
      expect(parentAPI?.double(parentAPI.initial)).toEqual(4);
    },
  };

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [pluginParent, pluginParent2, pluginChild],
    },
  });
  await rsbuild.build();
});

test('should allow exposed API to be scoped by environment', async () => {
  const results: string[] = [];
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      environments: {
        web: {
          plugins: [
            {
              name: 'plugin-child-web',
              setup(api) {
                const exposed = api.useExposed('test') as { name: string } | undefined;
                results.push(`web:${exposed?.name}`);
              },
            },
          ],
        },
        node: {
          output: {
            target: 'node',
          },
          plugins: [
            {
              name: 'plugin-child-node',
              setup(api) {
                const exposed = api.useExposed('test') as { name: string } | undefined;
                results.push(`node:${exposed?.name}`);
              },
            },
          ],
        },
      },
    },
  });

  rsbuild.expose('test', { name: 'web' }, { environment: 'web' });
  rsbuild.expose('test', { name: 'node' }, { environment: 'node' });

  await rsbuild.initConfigs();

  expect(results.sort()).toEqual(['node:node', 'web:web']);
});

test('should prefer environment exposed API and fallback to global exposed API', async () => {
  const results: string[] = [];
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      environments: {
        web: {
          plugins: [
            {
              name: 'plugin-child-web',
              setup(api) {
                const exposed = api.useExposed('test') as { name: string } | undefined;
                results.push(`web:${exposed?.name}`);
              },
            },
          ],
        },
        node: {
          output: {
            target: 'node',
          },
          plugins: [
            {
              name: 'plugin-child-node',
              setup(api) {
                const exposed = api.useExposed('test') as { name: string } | undefined;
                results.push(`node:${exposed?.name}`);
              },
            },
          ],
        },
      },
    },
  });

  rsbuild.expose('test', { name: 'global' });
  rsbuild.expose('test', { name: 'web' }, { environment: 'web' });

  await rsbuild.initConfigs();

  expect(results.sort()).toEqual(['node:global', 'web:web']);
});

test('should not expose environment scoped API to global plugins', async () => {
  let result: string | undefined;
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });

  rsbuild.expose('test', { name: 'web' }, { environment: 'web' });
  rsbuild.addPlugins([
    {
      name: 'plugin-child',
      setup(api) {
        result = api.useExposed<{ name: string }>('test')?.name;
      },
    },
  ]);

  await rsbuild.initConfigs();

  expect(result).toBeUndefined();
});

test('should override the previous exposed API in the same environment', async () => {
  let result = '';
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      environments: {
        web: {
          plugins: [
            {
              name: 'plugin-child-web',
              setup(api) {
                result = (api.useExposed('test') as { name: string } | undefined)?.name ?? '';
              },
            },
          ],
        },
      },
    },
  });

  rsbuild.expose('test', { name: 'old' }, { environment: 'web' });
  rsbuild.expose('test', { name: 'new' }, { environment: 'web' });

  await rsbuild.initConfigs();

  expect(result).toBe('new');
});
