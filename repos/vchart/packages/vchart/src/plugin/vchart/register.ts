import { Factory } from '../../core/factory';
import type { IVChartPluginConstructor } from './interface';

export const registerVChartPlugin = (plugin: IVChartPluginConstructor) => {
  Factory.registerVChartPlugin(plugin.type, plugin);
};
