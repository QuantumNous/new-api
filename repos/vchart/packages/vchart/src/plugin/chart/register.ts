import { Factory } from '../../core/factory';
import type { IChartPluginConstructor } from './interface';

export const registerChartPlugin = (plugin: IChartPluginConstructor) => {
  Factory.registerChartPlugin(plugin.type, plugin);
};
