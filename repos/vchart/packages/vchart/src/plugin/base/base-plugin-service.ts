import type { IBasePlugin, IBasePluginService } from './interface';
import { createID } from '../../util/id';
import { warn } from '../../util/debug';

export class BasePluginService<T extends IBasePlugin = IBasePlugin> implements IBasePluginService<T> {
  protected _plugins: T[];
  readonly id: number = createID();

  constructor() {
    this._plugins = [];
  }

  add(plugins: T[]): T[] | null {
    if (!plugins || plugins.length === 0) {
      return null;
    }
    const unloadedPlugins: T[] = [];
    plugins.forEach(plugin => {
      const isExist = this._plugins.find(p => p.id === plugin.id);
      if (isExist) {
        warn('不要重复添加相同的plugin');
        return;
      }
      this._plugins.push(plugin);
      unloadedPlugins.push(plugin);
      plugin.onAdd && plugin.onAdd(this);
    });

    return unloadedPlugins;
  }

  load(plugins: T[]): void {
    const unloadedPlugins = this.add(plugins);
    if (!unloadedPlugins || !unloadedPlugins.length) {
      return;
    }

    this.activate(plugins);
  }

  activate(plugins: T[]): void {
    if (!plugins.length) {
      return;
    }

    plugins.forEach(plugin => {
      plugin.init && plugin.init();
    });
  }

  get(id: number): T | undefined {
    return this._plugins.find(p => p.id === id);
  }

  getAll(): T[] {
    return this._plugins.slice();
  }

  release(pluginsId: number): void {
    const plugin = this.get(pluginsId);
    if (!plugin) {
      return;
    }
    plugin.release(this);
    this._plugins = this._plugins.filter(entry => entry !== plugin);
  }

  releaseAll(): void {
    this._plugins.forEach(plugin => {
      plugin.release(this);
    });

    this._plugins = [];
  }

  clear(pluginsId: number): void {
    const plugin = this.get(pluginsId);
    if (!plugin) {
      return;
    }
    plugin.clear(this);
  }

  clearAll(): void {
    this._plugins.forEach(plugin => {
      plugin.clear?.(this);
    });
  }
}
