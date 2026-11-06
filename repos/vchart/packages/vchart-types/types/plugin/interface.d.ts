import type { IChartPlugin, IChartPluginConstructor } from './chart/interface';
import type { ISeriesPlugin, ISeriesPluginConstructor } from './series/interface';
export type IPlugin = IChartPlugin | ISeriesPlugin;
export type IPluginConstructor = IChartPluginConstructor | ISeriesPluginConstructor;
