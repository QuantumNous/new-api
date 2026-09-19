import type { DataSet, IParserOptions } from '@visactor/vdataset';
import type {
  Datum,
  IDataValues,
  IInitOption,
  IMarkStateSpec,
  IPoint,
  IRegionQuerier,
  IShowTooltipOption,
  ISpec,
  ITooltipHandler,
  Maybe,
  MaybeArray,
  StringOrNumber
} from '../typings';
import type { IMorphConfig } from '../animation/spec';
import type { IBoundsLike } from '@visactor/vutils';
import type { EventCallback, EventParamsDefinition, EventQuery, EventType, ExtendEventParam } from '../event/interface';
import type { IMark, IMarkDataTransform } from '../mark/interface';
import type { ISeries } from '../series/interface/series';
import type { ITheme } from '../theme/interface';
import type { IComponent } from '../component/interface';
import type { LayoutCallBack } from '../layout/interface';
import type { DimensionIndexOption, IChart, IChartSpecInfo } from '../chart/interface';
import type { IEventTarget, IStage } from '@visactor/vrender-core';
import type { IContainerSize } from '@visactor/vrender-components';
import type { IBaseScale } from '@visactor/vscale';
import type { IUpdateSpecResult } from '../model/interface';
import type { ICompiler } from '../compile/interface';

export type DataLinkSeries = {
  /**
   * 关联的系列 id
   * the binding series id
   */
  seriesId?: StringOrNumber;
  /**
   * 关联的系列索引
   * the binding series index
   */
  seriesIndex?: number;
};

export type DataLinkAxis = {
  /**
   * 关联的轴 id，目前仅支持直角坐标轴
   * the binding axis id
   */
  axisId?: StringOrNumber;
  /**
   * 关联的轴索引，目前仅支持直角坐标轴
   * the binding axis index
   */
  axisIndex?: number;
};

export interface IVChartConstructor {
  new (spec: ISpec, options: IInitOption): IVChart;
  useRegisters: (comps: (() => void)[]) => any;
}

export interface IVChart {
  readonly id: number;

  /**
   * **同步**渲染图表。
   * @param morphConfig 图表 morph 动画配置，可选
   * @returns VChart 实例
   */
  renderSync: (morphConfig?: IMorphConfig) => IVChart;

  /**
   * **异步**渲染图表。
   * @async
   * @param morphConfig 图表 morph 动画配置，可选
   * @returns VChart 实例
   */
  renderAsync: (morphConfig?: IMorphConfig) => Promise<IVChart>;

  /**
   * **异步**更新数据。
   * @async
   * @param id 数据 id
   * @param data 数据值
   * @param options 数据参数
   * @returns VChart 实例
   */
  updateData: (id: StringOrNumber, data: Datum[] | string, options?: IParserOptions) => Promise<IVChart>;

  /**
   * **异步**批量更新数据。
   * @async
   * @param list 待更新的数据列表
   * @returns VChart 实例
   */
  updateDataInBatches: (list: { id: string; data: Datum[]; options?: IParserOptions }[]) => Promise<IVChart>;

  /**
   * **同步**更新数据。
   * @param id 数据 id
   * @param data 数据值
   * @param options 数据参数
   * @returns VChart 实例
   */
  updateDataSync: (id: StringOrNumber, data: Datum[], options?: IParserOptions) => IVChart;

  /**
   * **同步方法** 更新数据
   * @async
   * @param data 图表配置结构中的数据对象
   * @returns VChart 实例
   */
  updateFullDataSync: (data: IDataValues | IDataValues[], reRender?: boolean) => IVChart;

  /**
   * **同步方法** 更新数据
   * @param data 图表配置结构中的数据对象
   * @returns VChart 实例
   */
  updateFullData: (data: IDataValues | IDataValues[], reRender?: boolean) => Promise<IVChart>;

  /**
   * **异步**spec 更新。
   * @sync
   * @param spec
   * @param forceMerge
   * @returns
   */
  updateSpec: (
    spec: ISpec,
    forceMerge?: boolean,
    morphConfig?: IMorphConfig,
    userUpdateOptions?: IUpdateSpecResult
  ) => Promise<IVChart>;

  /**
   * **同步方法**spec 更新。
   * @param spec
   * @param forceMerge
   * @returns
   */
  updateSpecSync: (
    spec: ISpec,
    forceMerge?: boolean,
    morphConfig?: IMorphConfig,
    userUpdateOptions?: IUpdateSpecResult
  ) => void;

  /**
   * **同步方法** 模块 spec 更新
   * @param filter
   * @param spec
   * @param forceMerge
   * @returns
   * @since 1.4.0
   */
  updateModelSpecSync: (
    filter: string | { type: string; index: number },
    spec: unknown,
    forceMerge?: boolean,
    morphConfig?: IMorphConfig
  ) => IVChart;

  /**
   * **异步方法** 模块 spec 更新
   * @async
   * @param filter
   * @param spec
   * @param forceMerge
   * @returns
   * @since 1.4.0
   */
  updateModelSpec: (
    filter: string | { type: string; index: number },
    spec: unknown,
    forceMerge?: boolean,
    morphConfig?: IMorphConfig
  ) => Promise<IVChart>;

  /** 更新 spec 并重新编译（不渲染），返回是否成功 */
  updateSpecAndRecompile: (spec: ISpec, forceMerge: boolean, option: IVChartRenderOption) => boolean;

  /**
   * 更新绘制区域。
   * @param viewBox 绘制区域
   * @param reRender 是否重新渲染，默认为 true
   * @returns
   */
  updateViewBox: (viewBox: IBoundsLike, reRender?: boolean) => IVChart;

  /**
   * **异步方法**，图表尺寸更新方法。
   * @async
   * @param width 宽度
   * @param height 高度
   * @returns VChart 当前实例
   */
  resize: (width: number, height: number) => Promise<IVChart>;

  /**
   * 销毁图表。
   */
  release: () => void;

  /**
   * 事件监听
   */
  on: ((eType: EventType, handler: EventCallback<ExtendEventParam>) => void) &
    ((eType: EventType, query: EventQuery, handler: EventCallback<ExtendEventParam>) => void);
  off: (eType: EventType, handler?: EventCallback<ExtendEventParam>) => void;

  /**
   * 更新或设置图元状态。
   * @param state 状态筛选器
   * @param filter 筛选器
   */
  updateState: (
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean //series + mark 筛选
  ) => void;

  /**
   * 更新图元选中状态。
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
   * @param state 状态名
   *
   * @since 1.11.0
   */
  clearState: (state: string) => void;

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

  /**
   * 获取当前主题，会返回完整的主题配置（只能获取用户通过`setCurrentTheme`方法设置过的主题，默认值为`ThemeManager`统一设置的主题）
   * */
  getCurrentTheme: () => ITheme;

  /**
   * 获取当前主题名称（只能获取用户通过`setCurrentTheme`方法设置过的主题，默认值为`ThemeManager`统一设置的主题）
   */
  getCurrentThemeName: () => string;

  /**
   * **异步方法**， 设置当前主题。
   * @param name 主题名称
   * @returns
   */
  setCurrentTheme: (name: string) => Promise<IVChart>;

  /**
   * 自定义 TooltipHandler。
   * @param tooltipHandler
   */
  setTooltipHandler: (tooltipHandler: ITooltipHandler) => void;

  /**
   * 获取用户定义的 TooltipHandler
   * @returns ITooltipHandler
   */
  getTooltipHandlerByUser: () => ITooltipHandler | undefined;

  /**
   * 获取 TooltipHandler
   * @returns
   */
  getTooltipHandler: () => ITooltipHandler | undefined;

  /**
   * 手动调用展示 tooltip
   * @param datum 原始数据
   * @param options
   * @returns
   */
  showTooltip: (datum: Datum, options: IShowTooltipOption) => boolean;

  /**
   * 手动调用，关闭 tooltip
   * @returns
   */
  hideTooltip: () => boolean;

  // 图例相关 api
  /**
   * 根据图例组件 id 获取图例数据
   * @param id 组件 id
   * @returns
   */
  getLegendDataById: (id: string) => Datum[];

  /**
   * 根据图例组件索引获取图例数据
   * @param index 图例索引，默认为 0
   * @returns
   */
  getLegendDataByIndex: (index?: number) => Datum[];

  /**
   * 根据图例组件 id 获取当前图例的选中项
   * @param id 组件 id
   * @returns
   */
  getLegendSelectedDataById: (id: string) => StringOrNumber[];

  /**
   * 根据图例组件索引获取当前图例的选中项
   * @param index 图例索引，默认为 0
   * @returns
   */
  getLegendSelectedDataByIndex: (index?: number) => StringOrNumber[];

  /**
   * 根据图例组件 id 更新图例选中数据
   * @param id
   * @returns
   */
  setLegendSelectedDataById: (id: string, selectedData: StringOrNumber[]) => void;

  /**
   * 根据图例组件索引更新图例选中数据
   * @param index 图例索引，默认为 0
   * @returns
   */
  setLegendSelectedDataByIndex: (index: number, selectedData: StringOrNumber[]) => void;

  /**
   * **异步方法**返回一个包含图片展示的 data URI。
   * @returns data URI
   */
  getDataURL: () => Promise<any>;

  /**
   * **异步方法** 导出图表图片，只支持浏览器端。
   * @param name 保存的图片名称
   * @returns
   */
  exportImg: (name?: string) => Promise<void>;

  /**
   * 导出绘制了图表内容的 canvas
   * @returns HTMLCanvasElement
   * @since 1.5.2
   */
  exportCanvas: () => HTMLCanvasElement | undefined;

  /**
   * 目前仅支持 node 环境，用于 node 端的图片导出
   * @returns
   */
  getImageBuffer: () => void;
  /**
   * 设置自定义布局
   */
  setLayout: (layout: LayoutCallBack) => void;
  /**
   * 强制重新布局
   */
  reLayout: () => void;

  /**
   * 获取编译器实例
   * @returns
   */
  getCompiler: () => ICompiler;

  /**
   * Get the chart instance
   * 获取 Chart 图表实例。
   * @returns Chart 实例
   */
  getChart: () => Maybe<IChart>;

  /**
   * Get the renderer instance.
   * 获取渲染引擎实例。
   * @returns the instance of VRender Stage
   */
  getStage: () => IStage;

  /**
   * 获取 canvas dom
   * @returns HTMLCanvasElement | undefined
   */
  getCanvas: () => HTMLCanvasElement | undefined;

  /**
   * 获取图表的 dom 容器
   * @returns
   */
  getContainer: () => Maybe<HTMLElement>;

  /**
   * 获取图表所有的组件实例
   * @returns 组件实例
   */
  getComponents: () => IComponent[];

  /**
   * 获取图表的 DataSet 实例
   * @returns DataSet 实例
   */
  getDataSet: () => Maybe<DataSet>;

  /**
   * 获取图表的 Scale 实例
   * @param scaleId scale 的id
   * @returns Scale 实例
   * @since 1.10.4
   */
  getScale: (scaleId: string) => IBaseScale | null;

  /**
   * 手动调用触发 dimension 交互效果。
   * @param datum dimension 值
   * @param options 触发配置
   * @returns
   */
  setDimensionIndex: (value: StringOrNumber, options?: DimensionIndexOption) => void;

  /**
   * 如果传入参数, 则禁用/开启 dimension 交互事件
   * 如果不传入参数, 获取当前是否禁用 dimension 交互事件
   */
  disableDimensionHoverEvent: (disabled?: boolean) => void;

  /**
   * 禁用/开启 crosshair
   */
  disableCrossHair: (disabled: boolean) => void;

  /**
   * 禁用/开启 tooltip
   */
  disableTooltip: (disabled: boolean) => void;

  // 数据转换相关的 api
  /**
   * Convert the data to coordinate position
   * @param datum the datum to convert
   * @param dataLinkInfo the data link info, could be seriesId or seriesIndex, default is { seriesIndex: 0 }
   * @param isRelativeToCanvas 是否相对画布坐标，默认为 false Whether relative to canvas coordinates, default is false
   * @param checkInViewData 是否检查数据对应的图元是否在视图中，如果不在视图中，返回 null
   * @returns
   */
  convertDatumToPosition: (
    datum: Datum,
    dataLinkInfo?: DataLinkSeries,
    isRelativeToCanvas?: boolean,
    checkInViewData?: boolean
  ) => IPoint | null;

  /**
   * Convert the value to coordinate position
   * @param value number | [number, number], the value to convert
   * @param dataLinkInfo the data link info, could be seriesId,seriesIndex,axisId,axisIndex
   * @param isRelativeToCanvas 是否相对画布坐标，默认为 false Whether relative to canvas coordinates, default is false
   * returns
   */
  convertValueToPosition: ((
    value: StringOrNumber,
    dataLinkInfo: DataLinkAxis,
    isRelativeToCanvas?: boolean
  ) => number | null) &
    ((
      value: [StringOrNumber, StringOrNumber],
      dataLinkInfo: DataLinkSeries,
      isRelativeToCanvas?: boolean
    ) => IPoint | null);

  /**
   * 根据 indicator 组件 id 更新 indicator 数据
   * @param id spec 中定义的 indicator id
   * @param datum 具体数据项
   * @since 1.11.7
   */
  updateIndicatorDataById: (id: string, datum?: Datum) => void;

  /**
   * 根据 indicator 组件 id 更新 indicator 数据
   * @param index  indicator 索引下标
   * @param datum 具体数据项
   * @since 1.11.7
   */
  updateIndicatorDataByIndex: (index?: number, datum?: Datum) => void;

  /**
   * 地图缩放 API
   * @param [regionIndex=0] 根据索引顺序指定某个 region 区域的地图坐标系进行缩放
   * @param zoom 缩放比例
   * @param center 缩放中心
   * @since 1.11.10
   */
  geoZoomByIndex: (regionIndex: number, zoom: number, center?: { x: number; y: number }) => void;

  /**
   * 地图缩放 API
   * @param 根据 region id 指定某个 region 区域的地图坐标系进行缩放
   * @param zoom 缩放比例
   * @param center 缩放中心
   * @since 1.11.10
   */
  geoZoomById: (regionId: string | number, zoom: number, center?: { x: number; y: number }) => void;
  /**
   * @since 2.0.3
   * 当前图表是否开启了动画功能
   */
  isAnimationEnable: () => boolean;
  /** 停止正在进行的所有动画 */
  stopAnimation: () => void;

  /** 暂停正在进行的所有动画 */
  pauseAnimation: () => void;

  /** 恢复暂停时正在进行的所有动画 */
  resumeAnimation: () => void;

  /** 注册实例函数 */
  registerFunction: (key: string, fun: Function) => void;

  /** 注销实例函数 */
  unregisterFunction: (key: string) => void;

  /** 获取实例函数 */
  getFunction: (key: string) => Function | null;

  /** 获取实例函数列表 */
  getFunctionList: () => string[] | null;

  /** 获取图表 spec 详细信息 */
  getSpecInfo: () => IChartSpecInfo;

  /** 设置运行时 spec */
  setRuntimeSpec: (spec: any) => void;

  /** 获取运行时 spec */
  getSpec: () => any;

  /** 获取当前容器宽高 */
  getCurrentSize: () => IContainerSize;

  /** 旋转图表 需要注册插件 */
  rotate90WithTransform?: (rotateDom: HTMLElement) => void;

  /** 取消图表旋转 */
  cancelTransform?: (rotateDom: HTMLElement) => void;
}

export interface IGlobalConfig {
  /** 是否全局显示唯一 tooltip */
  uniqueTooltip?: boolean;
  /** 是否监测图表 dom 变化自动 release */
  // TODO
  // autoRelease?: boolean;
}

export interface IVChartRenderOption {
  /** morphing 动画 spec */
  morphConfig?: IMorphConfig;
  /** 是否重新转换图表 spec */
  transformSpec?: boolean;
  actionSource?: VChartRenderActionSource;
}

export type VChartRenderActionSource =
  | 'render'
  | 'updateSpec'
  | 'updateModelSpec'
  | 'setCurrentTheme'
  | 'updateSpecAndRecompile';

export interface VRenderComponentOptions {
  skipDefault?: boolean;
  mode?: '2d' | '3d';
}

export interface IStageEventPlugin<T> {
  new (
    taget: IEventTarget,
    cfg?: T
  ): {
    release: () => void;
  };
}

export interface GrammarTransformOption {
  /** 是否支持渐进流程 */
  canProgressive?: boolean;
  transform: IMarkDataTransform;
  runType?: 'beforeJoin' | 'afterEncode';
}

export interface UserEvent {
  eType: EventType;
  query: EventQuery | EventCallback<EventParamsDefinition[EventType]>;
  handler?: EventCallback<EventParamsDefinition[EventType]>;
}
