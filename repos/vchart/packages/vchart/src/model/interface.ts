import type { IBoundsLike } from '@visactor/vutils';
import type { DataSet, DataView } from '@visactor/vdataset';
import type { IEvent, IEventDispatcher } from '../event/interface';
import type { AnimationStateValues, IMark, IMarkGraphic, IMarkRaw, IMarkStyle, MarkTypeEnum } from '../mark/interface';
import type { RenderMode } from '../typings/spec/common';
import type { StringOrNumber } from '../typings/common';
import type { IGroupMarkSpec, ConvertToMarkStyleSpec, ICommonSpec } from '../typings/visual';
import type { IRect } from '../typings/space';
import type { IPoint, CoordinateType } from '../typings/coordinate';
import type { StateValueType } from '../typings/spec';
import type { ICompilable, ICompilableInitOption } from '../compile/interface';
import type { IGlobalScale } from '../scale/interface';
import type { IChart, IChartSpecInfo, IChartSpecTransformerOption } from '../chart/interface';
import type { IThemeColorScheme } from '../theme/color-scheme/interface';
import type { ILayoutItem, ILayoutItemSpec } from '../layout/interface';
import type { ILayoutPoint, ILayoutRect } from '../typings/layout';
import type { ComponentTypeEnum } from '../component/interface';
import type { SeriesTypeEnum } from '../series/interface';
import type { ITooltipSpec } from '../component/tooltip/interface';
import type { TooltipActiveType } from '../typings';
import type { IVChart } from '../core/interface';
import type { ICompilableData } from '../compile/data/interface';
import type { IDimensionData, IDimensionInfo } from '../event/events/dimension/interface';
import type { IAxis } from '../component/axis';
// TODO:
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModelInitOption {}
// TODO:
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModelLayoutOption {}
// TODO:
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModelEvaluateOption {}
// TODO:
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModelRenderOption {}

export interface IEffect {
  [key: string]: (e?: any) => any;
}

export interface IUpdateSpecEffects {
  remake?: boolean;
  compile?: boolean;
  render?: boolean;
  layout?: boolean;
  data?: boolean;
  scaleDomain?: boolean;
  series?: boolean;
  component?: boolean;
  animation?: boolean;
  localOnly?: boolean;
}

export interface IMarkTreeGroup extends Partial<IMarkStyle<IGroupMarkSpec>> {
  // 必须要有名字
  type: 'group';
  name: string;
  marks: (IMarkTreeGroup | IMark)[];
  // TODO: 这里要不要支持复杂场景，有图形组合的场景，用自定义mark？
  // from?: IData;
}

export type IMarkTree = IMarkTreeGroup | IMark | (IMarkTreeGroup | IMark)[];

export interface IUpdateSpecResult {
  change: boolean;
  reMake: boolean;
  reRender?: boolean;
  reSize?: boolean;
  // TODO: compile 的判断应不应该出现在这里?
  reCompile?: boolean;
  reTransformSpec?: boolean;
  effects?: IUpdateSpecEffects;
  reAnimate?: boolean;
  changeTheme?: boolean;
  changeBackground?: boolean;
}

export interface IUpdateDataResult {
  reAnimate?: boolean;
}

export interface IModel extends ICompilable {
  readonly modelType: string;
  readonly type: string;
  readonly specKey: string;
  readonly transformerConstructor: new (option: IBaseModelSpecTransformerOption) => IBaseModelSpecTransformer;

  readonly id: number;

  readonly userId?: StringOrNumber;

  // 事件
  readonly event: IEvent;

  // 副作用
  readonly effect: IEffect;

  coordinate?: CoordinateType;

  // 布局
  layout?: ILayoutItem;

  /** 是否可见 */
  getVisible: () => boolean;

  // 初始化参数
  getOption: () => IModelOption;

  getMarks: () => IMark[];
  getMarkNameMap: () => Record<string, IMark>;

  getData: () => ICompilableData;

  getChart: () => IChart;

  //生命周期
  // 创建模块自身内容，设置自身属性
  created: () => void;
  // 用来处理与其他图表模块的联系
  init: (option: IModelInitOption) => void;
  /** updateSpec 或者切换主题后，根据新 spec 执行的初始化过程 */
  reInit: (spec?: any) => void;
  beforeRelease: () => void;

  onEvaluateEnd: (ctx: IModelEvaluateOption) => void;
  onDataUpdate: () => void;
  onBeforeRender: () => void;

  updateSpec: (spec: any, totalSpec?: any) => IUpdateSpecResult;
  getSpec?: () => any;
  getSpecIndex: () => number;
  getSpecPath: () => Array<string | number>;

  //布局周期
  onLayoutStart: (layoutRect: IRect, viewRect: ILayoutRect) => void;
  onLayoutEnd: () => void;

  getColorScheme: () => IThemeColorScheme | undefined;

  setMarkStyle: <T extends ICommonSpec>(
    mark?: IMarkRaw<T>,
    style?: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>,
    state?: StateValueType,
    level?: number
  ) => void;

  initMarkStyleWithSpec: (mark?: IMark, spec?: any) => void;

  getSpecInfo: () => IModelSpecInfo;

  updateAnimateStateCallback: (callback: (graphic: IMarkGraphic) => AnimationStateValues) => void;
  getAnimationStateCallback: () => (graphic: IMarkGraphic) => AnimationStateValues;
}

export interface ILayoutModel extends IModel {
  // 布局相关
  getLayoutStartPoint: () => IPoint;
  setLayoutStartPosition: (pos: Partial<IPoint>) => void;
  getLayoutRect: () => ILayoutRect;
  setLayoutRect: (rect: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRect>) => void;

  getLastComputeOutBounds: () => IBoundsLike;

  getBoundsInRect: (rect: ILayoutRect, fullRect: ILayoutRect) => IBoundsLike;

  //布局周期
  afterSetLayoutStartPoint: (pos: ILayoutPoint) => void;
}

export interface IModelOption extends ICompilableInitOption {
  type: string;
  eventDispatcher: IEventDispatcher;
  dataSet: DataSet;
  map: Map<StringOrNumber, IModel | IMark>;
  mode: RenderMode;
  globalInstance: IVChart;
  regionIndexes?: Array<number>;
  specKey?: string;
  specPath?: Array<string | number>;
  specInfoPath?: Array<string | number>;

  getTheme?: (...keys: string[]) => any;
  getSpecInfo?: () => IChartSpecInfo;
  getChartLayoutRect: () => IRect;
  getChartViewRect: () => ILayoutRect;

  getChart: () => IChart;
  getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => DataView | undefined;

  globalScale: IGlobalScale;
  animation?: boolean;
  /**
   * 错误消息回调函数
   */
  onError: (...args: any[]) => void;

  /**
   * 是否关闭交互效果
   */
  disableTriggerEvent?: boolean;

  /**
   * 组件内容展示配置
   * @since 2.0.11
   */
  componentShowContent?: {
    /**
     * tooltip 是否关闭内容展示
     * @default false
     */
    tooltip?: boolean | Partial<Record<TooltipActiveType, boolean>>;
    // crosshair 组件是否展示
    crosshair?: boolean;
  };

  getDimensionInfo?: (chart: IChart | undefined, pos: ILayoutPoint, isTooltip?: boolean) => IDimensionInfo[] | null;
  getDimensionInfoByValue?: (axis: IAxis, value: any) => IDimensionInfo | null;
  getRectByDimensionData?: (dimensionData: IDimensionData, layoutStartPoint: ILayoutPoint) => any;

  dispatchEvent?: (key: string, params?: any) => void;
}

export interface IModelSpecInfo<T extends Record<string, unknown> = any> {
  /** model 具体类型 */
  type: string | ComponentTypeEnum | SeriesTypeEnum;
  /** model spec */
  spec: T;
  /** 该 spec 在图表 spec 上的路径 */
  specPath?: Array<string | number>;
  /** 该 spec 在图表 spec info 上的路径 */
  specInfoPath?: Array<string | number>;
  /** model 当前主题 */
  theme?: any;
  /** model 对应的 region 索引 */
  regionIndexes?: number[];
  /** model 对应的 series 索引 */
  seriesIndexes?: number[];
}

export interface IModelConstructor {
  readonly builtInTheme?: any;
  readonly transformerConstructor: new (option: IBaseModelSpecTransformerOption) => IBaseModelSpecTransformer;
}

export type ILayoutModelState = {
  layoutUpdateRank: number;
  [key: string]: unknown;
};

// TODO: 补充model共有配置
export type IModelSpec = ILayoutItemSpec & { id?: StringOrNumber };

export interface IModelMarkInfo {
  /** mark 类型 */
  type: MarkTypeEnum | string | (MarkTypeEnum | string)[];
  /** mark 名称 */
  name: string;
}

export type IBaseModelSpecTransformerOption = IChartSpecTransformerOption;

export interface IBaseModelSpecTransformerResult<T, K> {
  spec: T;
  theme: K;
}

export interface IBaseModelSpecTransformer {
  getTheme: (spec: any, chartSpec: any) => any;
  transformSpec: (
    spec: any,
    chartSpec: any,
    chartSpecInfo?: IChartSpecInfo
  ) => IBaseModelSpecTransformerResult<any, any>;
}

export interface ITooltipHelper {
  /** tooltip对应spec */
  spec: ITooltipSpec | undefined;

  /** 实际生效的tooltip activeType */
  activeType: TooltipActiveType[];

  /** 可以响应mark tooltip或者dimension tooltip的对象 */
  activeTriggerSet: {
    mark?: Set<IMark>;
    group?: Set<IMark>;
  };
  /** 不响应tooltip且不会影响已有tooltip的对象 */
  ignoreTriggerSet: {
    mark?: Set<IMark>;
  };

  /** 更新spec */
  updateTooltipSpec: () => void;
}
