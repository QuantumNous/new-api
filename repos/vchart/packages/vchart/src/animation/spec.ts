import type { EasingType, IGraphic } from '@visactor/vrender-core';
import type { IAnimationConfig, IStateAnimationConfig } from './interface';

export interface ICommonStateAnimateSpec {
  /**
   * 图表动画时长
   */
  duration?: number;
  /**
   * 动画延迟开始的时长
   */
  delay?: number;
  /**
   * 动画缓动效果
   */
  easing?: EasingType;
  /**
   * 是否轮流执行
   */
  oneByOne?: boolean;
}

export interface IStateAnimateSpec<Preset extends string> extends ICommonStateAnimateSpec {
  /**
   * 预设动画效果
   */
  preset?: Preset | false;
}

export type IMarkAnimateSpec<MarkName extends string> = Partial<
  Record<MarkName, false | IAnimationConfig | IAnimationConfig[]>
>;

export interface IAnimationSpec<MarkName extends string, Preset extends string> {
  /**
   * 图表入场动画
   * 支持配置图表内置不同动画效果
   */
  animationAppear?: boolean | IStateAnimateSpec<Preset> | IMarkAnimateSpec<MarkName>;
  /**
   * 数据更新 - 新增数据动画
   */
  animationEnter?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /**
   * 数据更新 - 数据更新动画
   */
  animationUpdate?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /**
   * 数据更新 - 数据删除动画
   */
  animationExit?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /**
   * 图表退场动画
   */
  animationDisappear?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /**
   * 状态切换动画
   * @since 1.12.0
   */
  animationState?: boolean | IStateAnimationConfig;
  /**
   * 循环动画
   */
  animationNormal?: IMarkAnimateSpec<MarkName>;
}
export interface IMorphSeriesSpec {
  /**
   * 系列全局动画是否开启
   * @default true
   */
  enable?: boolean;
  /**
   * 图元匹配字段
   * 系列前后根据 morphKey 配置的内容进行关联
   */
  morphKey?: string;
  /**
   * 数据匹配字段
   * 多数据图元可配置
   */
  morphElementKey?: string;
}

export type MorphData = { prev: any[]; next: any[] };
export type MorphElements = { prev: IGraphic[]; next: IGraphic[] };

export type MorphFunctionCallback<T> = (datum: MorphData, element: MorphElements, parameters: any) => T;

export type MorphFunctionType<T> = T | MorphFunctionCallback<T>;

export type MorphFunctionValueType<T> = MorphFunctionType<T> | T;

export interface IMorphAnimationConfig {
  easing?: EasingType;
  delay?: MorphFunctionValueType<number>;
  duration?: MorphFunctionValueType<number>;
  oneByOne?: MorphFunctionValueType<boolean | number>;
  splitPath?: MorphFunctionValueType<'clone' | null | undefined>;
}

export interface IMorphConfig {
  /** whether enable reusing of grammar */
  reuse?: boolean;
  /** whether enable morph */
  morph?: boolean;
  /** force all marks to participate in morphing */
  morphAll?: boolean;
  /** morphing animation config */
  animation?: IMorphAnimationConfig;
  /** whether apply exit animations for released marks */
  enableExitAnimation?: boolean;
}
