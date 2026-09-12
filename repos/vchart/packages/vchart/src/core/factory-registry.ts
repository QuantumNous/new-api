import type { Transform, Parser } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { fields, filter, fold, csvParser, dsvParser, tsvParser } from '@visactor/vdataset';
import type { IChartConstructor } from '../chart/interface';
import type { ISeriesConstructor } from '../series/interface';
import type { IComponentConstructor } from '../component/interface';
import type { MarkConstructor } from '../mark/interface';
import type { IRegionConstructor } from '../region/interface';
import type { ILayoutConstructor } from '../layout/interface';
import type { IChartPluginConstructor } from '../plugin/chart/interface';
import type { IComponentPluginConstructor } from '../plugin/components/interface';
import type { IApp, IGraphic } from '@visactor/vrender-core';
import type { GrammarTransformOption, IStageEventPlugin, VRenderComponentOptions } from './interface';
import type { MarkAnimationSpec } from '../animation/interface';
import type { ITriggerConstructor } from '../interaction/interface/trigger';
import type { IComposedEventConstructor } from '../index-harmony-simple';
import type { ITooltipProcessorConstructor } from '../component/tooltip/processor/interface';
import type { IVChartPluginConstructor } from '../plugin/vchart';

export interface IFactoryRegistry {
  charts: { [key: string]: IChartConstructor };
  series: { [key: string]: ISeriesConstructor };
  components: {
    [key: string]: {
      cmp: IComponentConstructor;
      alwaysCheck?: boolean;
      createOrder: number;
    };
  };
  graphicComponents: Record<string, (attrs: any, options?: VRenderComponentOptions) => IGraphic>;
  marks: { [key: string]: MarkConstructor };
  regions: { [key: string]: IRegionConstructor };
  animations: { [key: string]: (params?: any, preset?: any) => MarkAnimationSpec };
  implements: { [key: string]: (...args: any) => void };
  chartPlugin: { [key: string]: IChartPluginConstructor };
  vChartPlugin: { [key: string]: IVChartPluginConstructor };
  componentPlugin: { [key: string]: IComponentPluginConstructor };
  transforms: { [key: string]: Transform };
  dataParser: { [key: string]: Parser };
  layout: { [key: string]: ILayoutConstructor };
  grammarTransforms: Record<string, GrammarTransformOption>;
  stageEventPlugins: Record<string, IStageEventPlugin<any>>;
  interactionTriggers: Record<string, ITriggerConstructor>;
  composedEventMap: Record<string, IComposedEventConstructor>;
  tooltipProcessors: Record<string, ITooltipProcessorConstructor>;
  runtimePluginInstallers: Record<string, (app?: IApp) => void>;
  formatter?: (text: string | number | string[] | number[], datum: any, formatter: string | string[]) => any;
}

const createFactoryRegistry = (): IFactoryRegistry => ({
  charts: {},
  series: {},
  components: {},
  graphicComponents: {},
  marks: {},
  regions: {},
  animations: {},
  implements: {},
  chartPlugin: {},
  vChartPlugin: {},
  componentPlugin: {},
  transforms: {
    // buildIn transforms
    fields,
    filter,
    fold
  },
  dataParser: {
    // buildIn parser
    csv: csvParser,
    dsv: dsvParser,
    tsv: tsvParser
  },
  layout: {},
  grammarTransforms: {},
  stageEventPlugins: {},
  interactionTriggers: {},
  composedEventMap: {},
  tooltipProcessors: {},
  runtimePluginInstallers: {},
  formatter: undefined
});

const factoryRegistryVersion = typeof __VERSION__ === 'undefined' ? 'unknown' : __VERSION__;
const factoryRegistryKey = Symbol.for(`@visactor/vchart/factory-registry@${factoryRegistryVersion}`);
const globalFactoryRegistry = globalThis as typeof globalThis & {
  [factoryRegistryKey]?: IFactoryRegistry;
};

export const factoryRegistry: IFactoryRegistry =
  globalFactoryRegistry[factoryRegistryKey] ?? (globalFactoryRegistry[factoryRegistryKey] = createFactoryRegistry());
