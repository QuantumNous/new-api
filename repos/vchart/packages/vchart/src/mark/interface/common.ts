import type { IGlobalScale } from '../../scale/interface';
import type { ICommonSpec, VisualType, ValueType, FunctionType } from '../../typings/visual';
import type { IModel } from '../../model/interface';
import type { IBaseScale } from '@visactor/vscale';
import type { MarkType, MarkTypeEnum } from './type';
import type {
  ICompilableMark,
  ICompilableMarkOption,
  IMarkConfig,
  IModelMarkAttributeContext,
  StateValueType
} from '../../compile/mark/interface';
import type { Datum, StringOrNumber } from '../../typings';
import type { IGraphic } from '@visactor/vrender-core';
import type { IGroupMark } from './mark';
import type { IAnimationConfig } from '../../animation/interface';
import type { ICompiler } from '../../compile/interface';

export interface VisualScaleType {
  scale: IBaseScale;
  field: StringOrNumber;
  changeDomain?: 'none' | 'replace' | 'expand'; //default 'none'
}

export type MarkInputStyle<T> = StyleConvert<T> | VisualType<T>;

/** 用户将属性类型转化为 mark-style 中某个属性的 style */
export type StyleConvert<T> = ValueType<T> | FunctionType<T> | VisualScaleType;

/** mark-style 中某个属性的样式信息，包含层级等信息 */
export interface IAttrConfig<A, R extends ICommonSpec> {
  level: number;
  style: StyleConvert<A>;
  referer?: IMarkRaw<R>;
  postProcess?: (result: A, ...args: Parameters<FunctionType<A>>) => A;
}
/** mark-style 中某状态下的一组样式信息 */
export type IAttrs<T extends ICommonSpec> = {
  [K in keyof T]: IAttrConfig<T[K], T>;
};

export type IMarkProgressiveConfig = {
  /** 是否开启大数据渲染模式，开启后会降低渲染的精度 */
  large?: boolean;
  /** 开启大数据渲染优化的阀值，对应的是data的长度;推荐 largeThreshold < progressiveThreshold  */
  largeThreshold?: number;
  /** 分片长度 */
  progressiveStep?: number;
  /** 开启分片渲染的阀值，对应的是单系列data的长度 */
  progressiveThreshold?: number;
};

/** mark-state-style */
export type IMarkStateStyle<T extends ICommonSpec> = Record<StateValueType, Partial<IAttrs<T>>>;

/** mark-style 一组style */
export type IMarkStyle<T extends ICommonSpec> = {
  [key in keyof T]: MarkInputStyle<T[key]>;
};

export type DiffStateValues = 'update' | 'enter' | 'exit';

export type AnimationStateValues = 'appear' | 'enter' | 'update' | 'exit' | 'disappear' | 'none' | 'state';

export interface IGraphicContext {
  /**
   * 编译器
   */
  compiler: ICompiler;
  /**
   * mark的类型
   */
  markType: MarkTypeEnum;
  /**
   * 图形所属mark对应的id，自增id
   */
  markId: number;
  /**
   * 图形所属model对应的id，自增id
   */
  modelId: number;
  /**
   * 图形所属mark对应的用户设置id
   */
  markUserId?: number | string;
  /**
   * 图形所属model对应的用户设置id
   */
  modelUserId?: number | string;
  /**
   * 数据对比状态
   */
  diffState?: DiffStateValues;
  /**
   * 是否正在被复用的图元
   */
  reusing?: boolean;
  /**
   * 复用图元时，保存的上一次的旧属性（用于平滑的过渡动画）
   */
  lastAttrs?: Record<string, any>;
  /**
   * 用于判定这个图元是第几个，在OneByOne动画中控制顺序
   */
  indexKey?: string;
  /**
   * 差异的属性
   */
  diffAttrs?: Record<string, any>;
  /**
   * VChart encode/transform 后、应用到 VRender graphic 前的下一轮属性快照。
   * 用于 VChart 的 afterEncode transform、diffAttrs 与动画参数，不等同于 VRender finalAttribute。
   */
  finalAttrs?: Record<string, any>;
  /**
   * 用于保存mark对应series的fieldX
   */
  fieldX?: string[];
  /**
   * 用于保存mark对应series的fieldX
   */
  originalFieldX?: string[];
  /**
   * 用于保存mark对应series的fieldY
   */
  fieldY?: string[];
  /**
   * 用于保存mark对应series的fieldY
   */
  originalFieldY?: string[];
  /**
   * 动画状态管理: 'appear' / 'enter' / 'update' / 'exit' / 'disappear'
   */
  animationState?: AnimationStateValues;
  /**
   * 数据
   */
  data?: Datum[];
  /**
   * 用于区分图形的唯一key，
   * 对于line/mark而言，和`groupKey` 是一致的
   * 对于其他图元，由 `groupKey` 和 `key` 拼装得到
   */
  uniqueKey?: string;
  /**
   * 唯一key
   */
  key?: string;
  /**
   * 分组key
   */
  groupKey?: string;
  /**
   * 状态
   */
  states?: string[];
  /**
   * 图元总数量
   */
  graphicCount?: number;
  /**
   * 图元索引顺序
   */
  graphicIndex?: number;
  /**
   * 状态动画配置
   */
  stateAnimateConfig?: IAnimationConfig | IAnimationConfig[];
}

export interface IMarkGraphic extends IGraphic {
  /**
   * 缓存运行时的状态编码数据
   */
  runtimeStateCache?: Record<string, any>;

  /**
   * 上下文数据
   */
  context?: IGraphicContext;

  /**
   * 是否正在退场
   */
  isExiting?: boolean;
}

/**********   mark  ***************/
export interface IMarkRaw<T extends ICommonSpec> extends ICompilableMark {
  readonly stateStyle: IMarkStateStyle<T>;

  getAttributesOfState: (datum: Datum, state?: StateValueType) => Partial<T>;
  getAttribute: <U extends keyof T>(key: U, datum: any, state?: StateValueType) => unknown;
  setAttribute: <U extends keyof T>(attr: U, style: StyleConvert<T[U]>, state?: StateValueType, level?: number) => void;

  // 需要支持优先级并且可以使用优先级覆盖
  /** @deprecated VChart 层尽量使用 IModel.setMarkStyle() */
  setStyle: (style: Partial<IMarkStyle<T>>, state?: StateValueType, level?: number) => void;
  setSimpleStyle: (s: T) => void;
  getSimpleStyle: () => T;

  setReferer: (mark: IMarkRaw<T>, styleKey?: string, state?: StateValueType) => void;

  /** @deprecated VChart 层尽量使用 IModel.initMarkStyleWithSpec() */
  initStyleWithSpec: (spec: any) => void;

  created: () => void;

  setPostProcess: <U extends keyof T, A>(
    key: U,
    postProcessFunc: IAttrConfig<A, T>['postProcess'],
    state?: StateValueType
  ) => void;

  /** 更新某一个状态 */
  updateMarkState: (key: string) => void;

  render: () => void;
  renderInner: () => void;

  getGraphics: () => IMarkGraphic[];

  reuse: (mark: IMark) => void;
  prepareMorph: (mark: IMark) => void;

  clearExitGraphics: () => void;

  /** 是否启动了增量渲染模式 */
  isProgressive: () => boolean;
  /** 是否正在执行增量渲染 */
  isDoingProgressive: () => boolean;
  /** 清除增量渲染相关状态 */
  clearProgressive: () => void;
  /** 从第一帧开始增量计算 */
  restartProgressive: () => void;
  /** 分片执行 */
  renderProgressive: () => void;
  /** 增量流程后，是否执行动画 */
  canAnimateAfterProgressive: () => boolean;
  /** 执行动画 */
  runAnimation: () => void;
  /** 获取动画状态 */
  getAnimationState: () => AnimationStateValues;
  /** 是否需要清除旧的数据 */
  needClear?: boolean;
  /** 禁用状态动画 */
  disableAnimationByState: (state: string | string[]) => void;
  /** 启用状态动画 */
  enableAnimationByState: (state: string | string[]) => void;
  /** 重新加载前清除缓存 */
  clearBeforeReInit: () => void;
}

export type IMark = IMarkRaw<ICommonSpec>;

export interface ICompileMarkConfig extends IMarkConfig {
  /** morph 配置开关 */
  morph?: boolean;

  /** morph元素的唯一key */
  morphElementKey?: string;
  /**
   * 是否支持 3d
   */
  support3d?: boolean;
  /**
   * 裁剪配置
   * @since 1.10.0
   */
  clip?: boolean;
  /** skip theme of vgrammar or not */
  skipTheme?: boolean;
}

export interface IMarkOption extends ICompilableMarkOption {
  model: IModel;
  map: Map<StringOrNumber, IModel | IMark>;

  globalScale: IGlobalScale;
  seriesId?: number;

  /** 组件 mark 的具体类型 */
  componentType?: string;
  attributeContext?: IModelMarkAttributeContext;

  /** 父级 mark */
  parent?: IGroupMark | false;
}
export interface IMarkConstructor {
  type: MarkType;
  constructorType?: MarkType;
  new (name: string, options: IMarkOption): IMark;
}

export interface IComponentMarkConstructor {
  type: MarkType;
  constructorType?: MarkType;
  new (componentType: string, name: string, options: IMarkOption): IMark;
}

export type MarkConstructor = IMarkConstructor | IComponentMarkConstructor;

export interface IMarkDataInitOption extends IMarkOption {
  mark: IMark;
}

export type ISamplingMethod = 'lttb' | 'min' | 'max' | 'sum' | 'average';

export interface IDataSamping {
  /**
   * 是否使用额外的 activePoint 显示交互点，可以在点隐藏时显示被交互的点
   * @default false
   * @since 1.3.0
   */
  activePoint?: boolean;
  /**
   * 数据采样 - 采样方法
   * @since 1.6.0
   */
  sampling?: ISamplingMethod;
  /**
   * 数据采样 - 采样系数
   * @since 1.6.0
   * @default 1
   */
  samplingFactor?: number;
}

export interface IMarkOverlap {
  /**
   * 标记点之间的距离，px
   * @since 1.6.0
   */
  pointDis?: number;
  /**
   * 标记点之间的距离， pointSize 的倍数
   * @since 1.6.0
   * @default 1
   */
  pointDisMul?: number;
  /**
   * 是否允许标记图形相互覆盖
   * @since 1.6.0
   * @default false
   */
  markOverlap?: boolean;
}

export type GroupedData<T> = {
  // iterating over array is faster than set
  keys: string[];
  // operation on map is faster than object
  data: Map<string, T[]>;
};

export interface IProgressiveTransformResult<Output = any> {
  /** is progressive finished */
  unfinished: () => boolean;
  /** return all the result */
  output: () => Output;
  /** the output result of current progressive run */
  progressiveOutput: () => Output;
  /** run in progressive mode */
  progressiveRun: () => void;
  /** release the progressive context */
  release: () => void;
  /**
   * can animate after progressive
   */
  canAnimate?: () => boolean;
}

export type IMarkDataTransform<Options = any, Input = any, Output = any> = (
  options: Options,
  data: Input
) => Output | IProgressiveTransformResult<Output>;

export interface ProgressiveContext {
  currentIndex: number;
  totalStep: number;
  step: number;
  data: any[];
  groupKeys?: string[];
  groupedData?: Map<string, any[]>;
}
