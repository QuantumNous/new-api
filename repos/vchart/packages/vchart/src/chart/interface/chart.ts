import type { IEvent } from '../../event/interface';
import type { LayoutCallBack } from '../../layout/interface';
import type { IParserOptions } from '@visactor/vdataset';
import type { IComponent, IComponentConstructor } from '../../component/interface';
import type { IMark } from '../../mark/interface';
import type { IModel, IModelConstructor, IModelOption, IModelSpecInfo, IUpdateSpecResult } from '../../model/interface';
import type { IRegion, IRegionConstructor } from '../../region/interface';
import type { ISeries, ISeriesConstructor } from '../../series/interface';
import type {
  IChartEvaluateOption,
  IChartLayoutOption,
  IChartOption,
  IChartRenderOption,
  IChartSpecInfo,
  IChartSpecTransformerOption
} from './common';
import type { IBoundsLike, IPadding, Maybe } from '@visactor/vutils';
import type { ICompilable } from '../../compile/interface';
import type {
  IRegionQuerier,
  MaybeArray,
  Datum,
  IMarkStateSpec,
  StringOrNumber,
  IShowTooltipOption,
  IDataValues,
  ILayoutRect,
  IData
} from '../../typings';
// eslint-disable-next-line no-duplicate-imports
import type { DataView } from '@visactor/vdataset';
import type { IGlobalScale } from '../../scale/interface';
import type { IMorphConfig } from '../../animation/spec';
import type { IMarkGraphic } from '../../mark/interface/common';
import type { IAxis } from '../../component/axis/interface';

export type DimensionIndexOption = {
  filter?: (cmp: IComponent) => boolean;
  tooltip?: boolean;
  showTooltipOption?: IShowTooltipOption;
  crosshair?: boolean;
};

export interface IChartData {
  parseData: (dataSpec: IData) => void;
  updateData: (dataSpec: IData, fullUp?: boolean, forceMerge?: boolean) => boolean;
  getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => DataView | undefined;
}

export interface IChart extends ICompilable {
  padding: IPadding;

  readonly type: string;
  readonly chartData: IChartData;
  readonly transformerConstructor: new (option: IChartSpecTransformerOption) => IChartSpecTransformer;

  getSpec: () => any;
  setSpec: (s: any) => void;

  // data flow
  reDataFlow: () => void;

  setCanvasRect: (width: number, height: number) => void;
  getCanvasRect: () => ILayoutRect;
  getViewRect: () => ILayoutRect;

  getOption: () => IChartOption;

  getModelOption: () => IModelOption;
  /**
   * 图表更新的时候按需调用
   * @since 1.11.0
   */

  /** event */
  getEvent: () => IEvent;

  /**
   * @since 1.10.4
   */
  getGlobalScale: () => IGlobalScale;

  /** layout */
  setLayout: (layout: LayoutCallBack) => void;
  layout: () => void;
  getLayoutTag: () => boolean;
  setLayoutTag: (tag: boolean, morphConfig?: IMorphConfig, renderNextTick?: boolean) => boolean;
  resetLayoutItemTag: () => void;

  // 使用parse前的原始数据结构更新数据
  updateData: (id: StringOrNumber, data: unknown, updateGlobalScale?: boolean, options?: IParserOptions) => void;
  // 使用 IData 更新数据
  updateFullData: (data: IDataValues | IDataValues[]) => void;
  // update scale domain which in GlobalScale
  updateGlobalScaleDomain: () => void;
  //生命周期
  created: (transformer: Maybe<IChartSpecTransformer>) => void;
  init: () => void;
  onLayoutStart: (ctx: IChartLayoutOption) => void;
  onLayoutEnd: (ctx: IChartLayoutOption) => void;
  onEvaluateEnd: (ctx: IChartEvaluateOption) => void;
  onResize: (width: number, height: number, reRender: boolean) => void;
  onLayout: () => void;
  onBeforeRender: () => void;

  /**
   * 图表更新的时候按需调用
   * @since 1.11.0
   */
  reInit: () => void;

  // series
  getAllSeries: () => ISeries[];

  // region
  getRegionsInIndex: (index?: number[]) => IRegion[];
  getRegionsInIds: (ids: number[]) => IRegion[];
  getAllRegions: () => IRegion[];
  getRegionsInUserIdOrIndex: (user_ids?: StringOrNumber[], index?: number[]) => IRegion[];
  getRegionsInQuerier: (query: MaybeArray<IRegionQuerier>) => IRegion[];

  // series
  getSeriesInIndex: (index?: number[]) => ISeries[];
  getSeriesInIds: (ids?: number[]) => ISeries[];
  getSeriesInUserIdOrIndex: (user_ids?: StringOrNumber[], index?: number[]) => ISeries[];
  getSeriesInUserId: (userId: StringOrNumber) => ISeries | undefined;

  // component
  getComponentByIndex: (key: string, index: number) => IComponent | undefined;
  getComponentByUserId: (userId: StringOrNumber) => IComponent | undefined;
  getComponentsByKey: (key: string) => IComponent[];
  getComponentsByType: (type: string) => IComponent[];
  getAllComponents: () => IComponent[];

  // model
  getModelById: (id: number) => IModel | undefined;
  getModelByUserId: (userId: StringOrNumber) => IModel | undefined;
  getModelInFilter: (
    filter: string | { type: string; index: number } | ((model: IModel) => boolean)
  ) => IModel | undefined;
  getAllModels: () => IModel[];

  // mark
  getMarkById: (id: number) => IMark | undefined;
  getAllMarks: () => IMark[];
  getMarkByUserName: (name: string) => IMark[];

  // spec
  updateSpec: (spec: any) => IUpdateSpecResult;

  // state
  /**
   * 更新或设置图元状态
   * @param state 状态筛选器
   * @param filter 筛选器
   */
  updateState: (
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean //series + mark 筛选
  ) => void;

  /**
   * 更新图元选中状态
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setSelected: (
    datum: MaybeArray<any> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;

  /**
   * 更新图元 hover 状态
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setHovered: (
    datum: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;
  /**
   * 清除所有图元的状态
   *
   * @since 1.11.0
   */
  clearState: (state: string) => void;
  /**
   * 清除所有图元的所有状态
   *
   * @since 1.12.4
   */
  clearAllStates: () => void;
  /**
   * 清除所有图元的选中状态
   *
   * @since 1.11.0
   */
  clearSelected: () => void;
  /**
   * 清除所有图元的hover状态
   *
   * @since 1.11.0
   */
  clearHovered: () => void;

  // 更新 viewBox
  updateViewBox: (viewBox: IBoundsLike, reLayout: boolean) => void;

  // 获取实际渲染的 canvas
  getCanvas: () => HTMLCanvasElement | undefined;

  setCurrentTheme: () => void;

  getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => DataView | undefined;
  // setDimensionIndex
  setDimensionIndex: (value: StringOrNumber, opt: DimensionIndexOption) => void;
  /**
   * 显示交叉线
   * @since 2.0.9
   */
  showCrosshair: (cb: (axis: IAxis) => false | string | number) => void;

  /**
   * 根据数据筛选图元
   * @since 1.13.9
   */
  filterGraphicsByDatum: (
    datum: MaybeArray<Datum> | null,
    opt?: {
      filter?: (series: ISeries, mark: IMark) => boolean;
      region?: IRegionQuerier;
      getDatum?: (el: IMarkGraphic, mark: IMark, s: ISeries, r: IRegion) => Datum;
      callback?: (el: IMarkGraphic, mark: IMark, s: ISeries, r: IRegion) => void;
      regionCallback?: (pickElements: IMarkGraphic[], r: IRegion) => void;
    }
  ) => IMarkGraphic[];
}

export interface IChartSpecTransformer {
  readonly type: string;
  readonly seriesType: string;

  /** 此方法不建议重写 */
  initChartSpec: (spec: any) => IChartSpecInfo;
  /** 将图表 spec 统一转换为 common chart spec */
  transformSpec: (spec: any) => void;
  /** 转换 model spec，应用主题 */
  transformModelSpec: (spec: any) => IChartSpecInfo;
  /** 根据图表 spec 生成 spec info */
  createSpecInfo: (
    chartSpec: any,
    transform?: (constructor: IModelConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => void
  ) => IChartSpecInfo;
  getSeriesRelatedSpecKeys: () => Record<string, true>;
  /** 枚举 spec 中每个有效的 region */
  forEachRegionInSpec: <K>(
    spec: any,
    callbackfn: (constructor: IRegionConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ) => K[];
  /** 枚举 spec 中每个有效的 series */
  forEachSeriesInSpec: <K>(
    spec: any,
    callbackfn: (constructor: ISeriesConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ) => K[];
  /** 枚举 spec 中每个有效的 component */
  forEachComponentInSpec: <K>(
    spec: any,
    callbackfn: (constructor: IComponentConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ) => K[];
}

export interface IChartConstructor {
  readonly type: string;
  readonly seriesType?: string;
  readonly series?: string | string[];
  readonly transformerConstructor: new (option: IChartSpecTransformerOption) => IChartSpecTransformer;
  new (spec: any, options: IChartOption): IChart;
}
