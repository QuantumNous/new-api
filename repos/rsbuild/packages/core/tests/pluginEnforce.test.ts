import type { RsbuildPlugin } from '../src';
import { sortPluginsByEnforce } from '../src/pluginManager';

describe('sort plugins by enforce order', () => {
  it('should sort plugins with different enforce values', () => {
    const plugins: RsbuildPlugin[] = [
      { name: 'normal-1', setup: () => {} },
      { name: 'post-1', setup: () => {}, enforce: 'post' },
      { name: 'pre-1', setup: () => {}, enforce: 'pre' },
      { name: 'normal-2', setup: () => {} },
      { name: 'pre-2', setup: () => {}, enforce: 'pre' },
      { name: 'post-2', setup: () => {}, enforce: 'post' },
    ];

    const result = sortPluginsByEnforce(plugins.map((instance) => ({ instance })));

    const names = result.map((item) => item.instance.name);
    expect(names).toEqual(['pre-1', 'pre-2', 'normal-1', 'normal-2', 'post-1', 'post-2']);
  });

  it('should handle plugins with only "pre" enforce', () => {
    const plugins: RsbuildPlugin[] = [
      { name: 'normal-1', setup: () => {} },
      { name: 'pre-1', setup: () => {}, enforce: 'pre' },
      { name: 'normal-2', setup: () => {} },
      { name: 'pre-2', setup: () => {}, enforce: 'pre' },
    ];

    const result = sortPluginsByEnforce(plugins.map((instance) => ({ instance })));

    const names = result.map((item) => item.instance.name);
    expect(names).toEqual(['pre-1', 'pre-2', 'normal-1', 'normal-2']);
  });

  it('should handle plugins with only "post" enforce', () => {
    const plugins: RsbuildPlugin[] = [
      { name: 'normal-1', setup: () => {} },
      { name: 'post-1', setup: () => {}, enforce: 'post' },
      { name: 'normal-2', setup: () => {} },
      { name: 'post-2', setup: () => {}, enforce: 'post' },
    ];

    const result = sortPluginsByEnforce(plugins.map((instance) => ({ instance })));

    const names = result.map((item) => item.instance.name);
    expect(names).toEqual(['normal-1', 'normal-2', 'post-1', 'post-2']);
  });
});
