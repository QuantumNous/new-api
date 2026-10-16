import type { IMark, IMarkGraphic, IMarkStateStyle, MarkType } from '../../mark/interface';
import type { IModel } from '../../model/interface';
import type { GrammarItemCompileOption, GrammarItemInitOption, IGrammarItem, StateValueMap } from '../interface';
import type { DataView } from '@visactor/vdataset';
import type { Maybe, Datum, StringOrNumber } from '../../typings';
import type { IRegion } from '../../region/interface';
import type { ICompilableData } from '../data/interface';
import type { ICustomPath2D, IGraphic, IGroup } from '@visactor/vrender-core';
import type { MarkAnimationSpec } from '../../animation/interface';

export interface IMarkConfig {
  clipPath?: IGraphic[] | ((graphics: IGraphic[]) => IGraphic[]);
  clip?: boolean;
  zIndex?: number;
  interactive?: boolean;
  /**
   * set customized shape
   */
  setCustomizedShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
  /** 是否开启大数据渲染模式 */
  large?: boolean;
  /** 开启大数据渲染优化的阀值，对应的是data的长度 */
  largeThreshold?: number;
  /** 分片长度 */
  progressiveStep?: number;
  /** 开启分片渲染的阀值，对应的是单系列data的长度 */
  progressiveThreshold?: number;
  /**
   * use 'sequential' for symbol chart
   * use 'mod' for bar/line chart
   */
  // largeChunkMode?: 'sequential' | 'mod';
  support3d?: boolean;
  /**
   * 象形图，给图形设置名称
   */
  graphicName?: string | ((g: IMarkConfig) => string);
  /**
   * enable global morphing animation of the mark
   */
  morph?: boolean;
  /**
   * this key will be used to match the mark to morph
   */
  morphKey?: string;
  /**
   * this key will be used to match the element of two marks to morph
   * If not specified, we'll use the "key" of the mark by default
   */
  morphElementKey?: string;

  overflow?: 'scroll' | 'hidden' | 'scroll-x' | 'scroll-y';
  skipTheme?: boolean;

  /**
   * 是否开启序列动画能力，默认关闭
   */
  useSequentialAnimation?: boolean;
}

export interface IMarkStateManager {
  getStateInfoList: () => IStateInfo[];
  getStateInfo: (stateValue: StateValue) => IStateInfo;
  addStateInfo: (stateInfo: IStateInfo) => void;
  changeStateInfo: (stateInfo: Partial<IStateInfo>) => void;
  clearStateInfo: (stateValues: StateValue[]) => void;
  clearAllStateInfo: () => void;
  checkOneState: (renderNode: IMarkGraphic, datum: Datum[], state: IStateInfo) => 'in' | 'out' | 'skip';
  checkState: (renderNode: IMarkGraphic, datum: Datum[]) => StateValue[];
  getStateMap: () => StateValueMap;
  updateState: (newState: Partial<StateValueMap>, noRender?: boolean) => void;
  release: () => void;
}

export interface IMarkData extends ICompilableData {
  setCompiledProductId: (name: string) => any;
  generateProductId: () => string;
}

export interface ICompilableMarkOption extends GrammarItemInitOption {
  key?: string | ((datum: Datum) => string);
  /** 分组字段，更多用于 morphing 动画的 element 匹配 */
  groupKey?: string;
  /** 是否在dataflow的过程中，布局前跳过该mark */
  skipBeforeLayouted?: boolean;

  /* VGrammar的组件是否支持3d */
  mode?: '2d' | '3d';
  /** don't separate style of mark */
  noSeparateStyle?: boolean;
}

export interface ICompilableMark extends IGrammarItem {
  // 类型
  readonly type: MarkType;
  // id
  readonly id: number;
  // name
  readonly name: string;
  // key field
  readonly key?: string | ((datum: Datum) => string);
  // parent model
  readonly model: IModel;

  /**
   * 上报发生了变更，需要更新
   */
  commit: (render?: boolean, recursion?: boolean) => void;
  uncommit: () => void;
  isCommited: () => boolean;

  // 数据 可以没有
  getData: () => ICompilableData | undefined;
  setData: (d: ICompilableData) => void;
  getDataView: () => DataView | undefined;
  setDataView: (d: DataView) => void;

  // 状态
  state: IMarkStateManager;
  readonly stateStyle: IMarkStateStyle<any>;
  hasState: (state: string) => boolean;
  getState: (state: string) => any;
  updateState: (newState: Record<string, unknown>) => void;
  /** 更新 mark 样式 */
  compileEncode: () => void;

  // 动画配置
  setAnimationConfig: (config: Partial<MarkAnimationSpec>) => void;
  getAnimationConfig: () => Partial<MarkAnimationSpec>;

  // 是否显示
  getVisible: () => boolean;
  setVisible: (visible: boolean) => void;

  // groupKey 配置
  setGroupKey: (groupKey: string) => void;

  // 用户 id
  getUserId: () => StringOrNumber | undefined;
  setUserId: (id: StringOrNumber) => void;

  compile: (option?: IMarkCompileOption) => void;

  getProduct: () => Maybe<IGroup>;

  /** 获取子mark */
  getMarks: () => ICompilableMark[];

  /** 是否跳过布局阶段 */
  setSkipBeforeLayouted: (skip: boolean) => void;

  getMarkConfig: () => IMarkConfig;
  setMarkConfig: (config: IMarkConfig) => void;

  getContext: () => any;

  /** 开始状态动画 */
  // runAnimationByState: (animationState?: string) => IAnimateArranger;
  // /** 停止状态动画*/
  // stopAnimationByState: (animationState?: string) => IAnimate;
  // /** 暂停状态动画*/
  // pauseAnimationByState: (animationState: string) => IAnimate;
  // /** 恢复状态动画*/
  // resumeAnimationByState: (animationState: string) => IAnimate;

  layout: (layoutCallback: () => void) => void;
  setDataLabelType?: () => string;
}

export interface IMarkCompileOption extends GrammarItemCompileOption {
  group?: IGroup;
  context?: any;
}

export interface IStateInfo {
  /** 状态值 */
  stateValue: StateValue;
  // 对应的数据维度 可以是多维度
  // TODO: fields 是否保留
  fields?: any | null | undefined;
  /** 筛选数据 */
  datums?: any[] | null | undefined;
  /** 筛选数据 */
  datumKeys?: string[] | null | undefined;
  /** 筛选 item */
  items?: any[] | null | undefined;
  /** 筛选函数 */
  filter?:
    | ((
        datum: any,
        options: {
          mark?: IMark;
          type?: string;
          renderNode?: IGraphic;
        }
      ) => boolean)
    | null
    | undefined;
  cache?: {
    [key: string]: {
      [key: string]: boolean;
    };
  };
  /** 状态优先级 */
  level?: number | undefined;
}
// TODO:目前看这个类型没有必要，确认后彻底删除
export interface IStateSpec {
  /** 状态值 */
  stateValue: StateValue;
  /** 筛选数据 */
  datums?: any[] | null | undefined;
  /** 筛选数据对应字段 */
  datumKeys?: string[] | null | undefined;
  /** TODO: 暂时不提供 filter 函数形式 */
  // filter?:
  //   | ((datum: any, options: Record<string, any>) => boolean)
  //   | null
  //   | undefined;
  /** 状态优先级 */
  level?: number | undefined;
}

export interface IMarkState {
  readonly id: number;
  // 状态
  getStates: () => IStateInfo[];

  // state 相关
  getState: (stateValue: StateValue) => IStateInfo | undefined;
  addState: (stateInfo: IStateInfo) => void;
  changeState: (stateInfo: Partial<IStateInfo>, update?: boolean) => void;
  checkState: (item: any, datum: any) => string[];

  clearState: (stateValues: StateValue[], update?: boolean) => void;

  // 更新
  update: () => void;
}

export enum STATE_VALUE_ENUM {
  STATE_NORMAL = 'normal',

  STATE_HOVER = 'hover',
  STATE_HOVER_REVERSE = 'hover_reverse',

  STATE_DIMENSION_HOVER = 'dimension_hover',
  STATE_DIMENSION_HOVER_REVERSE = 'dimension_hover_reverse',

  STATE_SELECTED = 'selected',
  STATE_SELECTED_REVERSE = 'selected_reverse',

  // todo: 2.0考虑优化
  STATE_SANKEY_EMPHASIS = 'selected',
  STATE_SANKEY_EMPHASIS_REVERSE = 'blur',

  STATE_HIGHLIGHT = 'highlight',
  STATE_BLUR = 'blur',

  STATE_ACTIVE = 'active'
}

export enum STATE_VALUE_ENUM_REVERSE {
  STATE_HOVER_REVERSE = 'hover_reverse',
  STATE_DIMENSION_HOVER_REVERSE = 'dimension_hover_reverse',
  STATE_SELECTED_REVERSE = 'selected_reverse'
}

export type STATE_NORMAL = typeof STATE_VALUE_ENUM.STATE_NORMAL;
export type STATE_HOVER = typeof STATE_VALUE_ENUM.STATE_HOVER;
export type STATE_HOVER_REVERSE = typeof STATE_VALUE_ENUM.STATE_HOVER_REVERSE;
export type STATE_CUSTOM = string;

// TODO: 待补充

export type StateValueNot = STATE_HOVER_REVERSE | STATE_CUSTOM;
export type StateValue = STATE_NORMAL | STATE_HOVER | STATE_CUSTOM;
export type StateValueType = StateValue | StateValueNot;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModelMarkAttributeContext {
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ISeriesMarkAttributeContext extends IModelMarkAttributeContext {
  // 通用的默认属性值获取，比如color，如果有散点图有sizeScale，则可以获取 size
  globalScale: (scaleKey: string, value: string | number) => unknown;
  // 传入seriesField值，获取对应的颜色。
  // 如果传入 null ，返回的是当前系列对应的第一个颜色值。
  seriesColor: (seriesValue?: string | number) => string;
  /**
   * 获取当前的 region
   * @returns
   */
  getRegion: () => IRegion;
}
