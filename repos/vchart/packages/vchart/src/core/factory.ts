import type {
  IChartConstructor,
  IChartOption,
  IChart,
  IChartSpecTransformerOption,
  IChartSpecTransformer
} from '../chart/interface';
import type { ISeriesConstructor, ISeriesMarkInfo, ISeriesOption, SeriesMarkNameEnum } from '../series/interface';
import type { IComponentConstructor } from '../component/interface';
import type { IMarkConstructor, IMarkOption, MarkConstructor } from '../mark/interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from '../mark/interface/type';
import type { IRegion, IRegionConstructor } from '../region/interface';
import type { IBaseModelSpecTransformer, IBaseModelSpecTransformerOption, IModelOption } from '../model/interface';
import type { Transform, Parser } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { fields, filter, fold, csvParser, dsvParser, tsvParser } from '@visactor/vdataset';
import type { ILayoutConstructor } from '../layout/interface';
import type { IChartPluginConstructor } from '../plugin/chart/interface';
import type { IComponentPluginConstructor } from '../plugin/components/interface';
import type { IGraphic } from '@visactor/vrender-core';
import type { GrammarTransformOption, IStageEventPlugin, VRenderComponentOptions } from './interface';
import type { MarkAnimationSpec } from '../animation/interface';
import type { IBaseTriggerOptions, ITriggerConstructor } from '../interaction/interface/trigger';
import type { IComposedEventConstructor } from '../index-harmony-simple';
import type { ITooltipProcessorConstructor } from '../component/tooltip/processor/interface';
import type { ITooltip } from '../component';
import type { IVChartPluginConstructor } from '../plugin/vchart';

export class Factory {
  private static _charts: { [key: string]: IChartConstructor } = {};
  private static _series: { [key: string]: ISeriesConstructor } = {};
  private static _components: {
    [key: string]: {
      cmp: IComponentConstructor;
      alwaysCheck?: boolean;
      createOrder: number;
    };
  } = {};
  private static _graphicComponents: Record<string, (attrs: any, options?: VRenderComponentOptions) => IGraphic> = {};
  private static _marks: { [key: string]: MarkConstructor } = {};
  private static _regions: { [key: string]: IRegionConstructor } = {};
  private static _animations: { [key: string]: (params?: any, preset?: any) => MarkAnimationSpec } = {};
  private static _implements: { [key: string]: (...args: any) => void } = {};
  private static _chartPlugin: { [key: string]: IChartPluginConstructor } = {};
  private static _vChartPlugin: { [key: string]: IVChartPluginConstructor } = {};
  private static _componentPlugin: { [key: string]: IComponentPluginConstructor } = {};
  private static _formatter: (
    text: string | number | string[] | number[],
    datum: any,
    formatter: string | string[]
  ) => any;

  static transforms: { [key: string]: Transform } = {
    // buildIn transforms
    fields: fields,
    filter: filter,
    fold: fold
  };
  static dataParser: { [key: string]: Parser } = {
    // buildIn parser
    csv: csvParser,
    dsv: dsvParser,
    tsv: tsvParser
  };
  static _layout: { [key: string]: ILayoutConstructor } = {};

  static registerChart(key: string, chart: IChartConstructor) {
    Factory._charts[key] = chart;
  }
  static registerSeries(key: string, series: ISeriesConstructor) {
    Factory._series[key] = series;
  }
  static registerComponent(key: string, cmp: IComponentConstructor, alwaysCheck?: boolean, createOrder?: number) {
    Factory._components[key] = { cmp, alwaysCheck, createOrder: createOrder ?? 0 };
  }

  static registerGraphicComponent(key: string, creator: (attrs: any, options?: VRenderComponentOptions) => IGraphic) {
    Factory._graphicComponents[key] = creator;
  }

  static createGraphicComponent(componentType: string, attrs: any, options?: VRenderComponentOptions) {
    const compCreator = Factory._graphicComponents[componentType];

    if (!compCreator) {
      return null;
    }

    return compCreator(attrs, options);
  }
  static registerMark(key: string, mark: MarkConstructor) {
    Factory._marks[key] = mark;
  }
  static registerRegion(key: string, region: IRegionConstructor) {
    Factory._regions[key] = region;
  }
  static registerTransform(key: string, transform: Transform) {
    Factory.transforms[key] = transform;
  }

  private static _grammarTransforms: Record<string, GrammarTransformOption> = {};

  static registerGrammarTransform(type: string, transform: GrammarTransformOption) {
    Factory._grammarTransforms[type] = transform;
  }

  static getGrammarTransform(type: string) {
    return Factory._grammarTransforms[type];
  }
  static registerLayout(key: string, layout: ILayoutConstructor) {
    Factory._layout[key] = layout;
  }
  static registerAnimation(key: string, animation: (params?: any, preset?: any) => MarkAnimationSpec) {
    Factory._animations[key] = animation;
  }
  static registerImplement(key: string, implement: (...args: any) => void) {
    Factory._implements[key] = implement;
  }
  static registerChartPlugin(key: string, plugin: IChartPluginConstructor) {
    Factory._chartPlugin[key] = plugin;
  }
  static registerVChartPlugin(key: string, plugin: IVChartPluginConstructor) {
    Factory._vChartPlugin[key] = plugin;
  }
  static registerComponentPlugin(key: string, plugin: IComponentPluginConstructor) {
    Factory._componentPlugin[key] = plugin;
  }

  static createChart(chartType: string, spec: any, options: IChartOption): IChart | null {
    if (!Factory._charts[chartType]) {
      return null;
    }
    const ChartConstructor = Factory._charts[chartType];
    return new ChartConstructor(spec, options);
  }

  static getChart(chartType: string) {
    return Factory._charts[chartType];
  }

  static createChartSpecTransformer(
    chartType: string,
    option: IChartSpecTransformerOption
  ): IChartSpecTransformer | null {
    if (!Factory._charts[chartType]) {
      return null;
    }
    const ChartConstructor = Factory._charts[chartType];
    const ChartSpecTransformerConstructor = ChartConstructor.transformerConstructor;
    return new ChartSpecTransformerConstructor({
      seriesType: ChartConstructor.seriesType,
      ...option
    });
  }

  static createRegion(regionType: string, spec: any, options: IModelOption): IRegion | null {
    if (!Factory._regions[regionType]) {
      return null;
    }
    const RegionConstructor = Factory._regions[regionType];
    return new RegionConstructor(spec, options);
  }

  static createRegionSpecTransformer(
    regionType: string,
    options: IBaseModelSpecTransformerOption
  ): IBaseModelSpecTransformer | null {
    if (!Factory._regions[regionType]) {
      return null;
    }
    const RegionConstructor = Factory._regions[regionType];
    const RegionSpecTransformerConstructor = RegionConstructor.transformerConstructor;
    return new RegionSpecTransformerConstructor(options);
  }

  static createSeries(seriesType: string, spec: any, options: ISeriesOption) {
    if (!Factory._series[seriesType]) {
      return null;
    }
    const SeriesConstructor = Factory._series[seriesType];
    return new SeriesConstructor(spec, options);
  }

  static createSeriesSpecTransformer(
    seriesType: string,
    options: IBaseModelSpecTransformerOption
  ): IBaseModelSpecTransformer | null {
    if (!Factory._series[seriesType]) {
      return null;
    }
    const SeriesConstructor = Factory._series[seriesType];
    const SeriesSpecTransformerConstructor = SeriesConstructor.transformerConstructor;
    return new SeriesSpecTransformerConstructor(options);
  }

  static createMark(markType: string, name: string, options: IMarkOption) {
    if (!Factory._marks[markType]) {
      return null;
    }
    const MarkConstructor = Factory._marks[markType] as IMarkConstructor;
    const markInstance = new MarkConstructor(name, options);
    if (markInstance.type === MarkTypeEnum.group) {
      // group 目前关闭交互，不参与事件拾取
      markInstance.setMarkConfig({ interactive: false });
    }
    return markInstance;
  }

  static getComponents() {
    return Object.values(Factory._components);
  }

  static getComponentInKey(name: string) {
    return Factory._components[name].cmp;
  }

  static getLayout() {
    return Object.values(Factory._layout);
  }

  static getLayoutInKey(name: string) {
    return Factory._layout[name];
  }

  static getSeries() {
    return Object.values(Factory._series);
  }

  static getSeriesInType(type: string) {
    return Factory._series[type];
  }

  static getRegionInType(type: string) {
    return Factory._regions[type];
  }

  static getAnimationInKey(key: string) {
    return Factory._animations[key];
  }

  static getImplementInKey(key: string) {
    return Factory._implements[key];
  }

  static getSeriesMarkMap(seriesType: string): Partial<Record<SeriesMarkNameEnum, ISeriesMarkInfo>> {
    if (!Factory._series[seriesType]) {
      return {};
    }
    return Factory._series[seriesType].mark;
  }

  static getSeriesBuiltInTheme(themeKey: string): Record<string, any> {
    for (const key in Factory._series) {
      const item = Factory._series[key];
      if (item && item.builtInTheme && item.builtInTheme[themeKey]) {
        return item.builtInTheme[themeKey];
      }
    }

    return null;
  }

  static getComponentBuiltInTheme(themeKey: string): Record<string, any> {
    for (const key in Factory._components) {
      const item = Factory._components[key];
      if (item && item.cmp && item.cmp.builtInTheme && item.cmp.builtInTheme[themeKey]) {
        return item.cmp.builtInTheme[themeKey];
      }
    }
    return null;
  }

  static getChartPlugins() {
    return Object.values(Factory._chartPlugin);
  }

  static getVChartPlugins() {
    return Object.values(Factory._vChartPlugin);
  }

  static getComponentPlugins() {
    return Object.values(Factory._componentPlugin);
  }

  static getComponentPluginInType(type: string) {
    return Factory._componentPlugin[type];
  }

  static registerFormatter(func: typeof Factory['_formatter']) {
    this._formatter = func;
  }

  static getFormatter() {
    return this._formatter;
  }

  private static _stageEventPlugins: Record<string, IStageEventPlugin<any>> = {};

  static registerStageEventPlugin = (type: string, Plugin: IStageEventPlugin<any>) => {
    Factory._stageEventPlugins[type] = Plugin;
  };

  static getStageEventPlugin = (type: string) => {
    return Factory._stageEventPlugins[type];
  };

  private static _interactionTriggers: Record<string, ITriggerConstructor> = {};

  static registerInteractionTrigger = (interactionType: string, interaction: ITriggerConstructor) => {
    Factory._interactionTriggers[interactionType] = interaction;
  };

  static createInteractionTrigger(interactionType: string, options?: IBaseTriggerOptions) {
    const Ctor = Factory._interactionTriggers[interactionType];
    if (!Ctor) {
      return null;
    }

    return new Ctor(options);
  }

  static hasInteractionTrigger(interactionType: string) {
    return !!Factory._interactionTriggers[interactionType];
  }

  private static _composedEventMap: Record<string, IComposedEventConstructor> = {};

  static registerComposedEvent = (eType: string, composedEvent: IComposedEventConstructor) => {
    Factory._composedEventMap[eType] = composedEvent;
  };

  static getComposedEvent(eType: string) {
    return Factory._composedEventMap[eType];
  }

  private static _tooltipProcessors: Record<string, ITooltipProcessorConstructor> = {};
  static registerTooltipProcessor = (type: string, processor: ITooltipProcessorConstructor) => {
    Factory._tooltipProcessors[type] = processor;
  };
  static createTooltipProcessor = (type: string, tooltip: ITooltip) => {
    const Cror = Factory._tooltipProcessors[type];
    if (!Cror) {
      return null;
    }
    return new Cror(tooltip);
  };
}
