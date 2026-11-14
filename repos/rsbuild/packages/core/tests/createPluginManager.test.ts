import { logger } from '../src';
import { createPluginManager } from '../src/pluginManager';

describe('createPluginManager', () => {
  it('should add and remove plugins correctly', () => {
    const pluginManager = createPluginManager(logger);
    expect(pluginManager.getPlugins()).toEqual([]);
    pluginManager.addPlugins([
      {
        name: 'foo',
        setup() {
          /* do nothing */
        },
      },
      {
        name: 'bar',
        setup() {
          /* do nothing */
        },
      },
    ]);
    expect(pluginManager.getPlugins()).toHaveLength(2);
    pluginManager.removePlugins(['foo']);
    expect(pluginManager.getPlugins()).toHaveLength(1);
    expect(pluginManager.isPluginExists('foo')).toBe(false);
  });
});
