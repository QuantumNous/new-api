import type { StringOrNumber } from '../../typings';
import type { IColor, IGroup, IStage } from '@visactor/vrender-core';
import type { IChart } from '../../chart/interface/chart';
import type { IVChart, IVChartRenderOption } from '../../core/interface';
import type { IMorphConfig } from '../../animation/spec';
import type { IBoundsLike } from '@visactor/vutils';
import type { EventSourceType, EventType } from '../../event/interface';
import type { IMark, IMarkGraphic } from '../../mark/interface';
import type { IRenderOption, LayoutState } from '../interface/compiler';
import type { MarkAnimationSpec } from '../../animation/interface';

export type CompilerListenerParameters = {
  type: EventType;
  event: Event;
  source: EventSourceType;
  item: IMarkGraphic | null;
  datum: any | null;
  markId: number | null;
  modelId: number | null;
  markUserId: StringOrNumber | null;
  modelUserId: StringOrNumber | null;
};

export interface IProductMap<T extends IGrammarItem> {
  /** 编译产物 id 和对应的在 vchart 中的 GrammarItem */
  [productId: string]: IGrammarItemMap<T>;
}

export interface IGrammarItemMap<T extends IGrammarItem> {
  /** GrammarItem id 和 对应的引用 */
  [id: number]: T;
}

export type ICompilerModel = Record<GrammarType, IProductMap<IGrammarItem>>;

export interface ICompiler {
  getOption: () => IRenderOption;
  isInited?: boolean;
  readonly stateAnimationConfig?: MarkAnimationSpec;
  getCanvas: () => HTMLCanvasElement | undefined;
  getStage: () => IStage | undefined;
  compile: (ctx: { chart: IChart; vChart: IVChart }, option?: IVChartRenderOption) => void;
  clear: (ctx: { chart: IChart; vChart: IVChart }, removeGraphicItems?: boolean) => void;
  renderNextTick: (morphConfig?: IMorphConfig) => void;
  render: (morphConfig?: IMorphConfig) => void;
  setStageAnimationConfig: (config: Partial<MarkAnimationSpec>) => void;
  updateViewBox: (viewBox: IBoundsLike, reRender?: boolean) => void;
  resize: (width: number, height: number, reRender?: boolean) => void;
  setBackground: (color: IColor) => void;
  setSize: (width: number, height: number) => void;
  setViewBox: (viewBox: IBoundsLike, reRender?: boolean) => void;
  addEventListener: (
    source: EventSourceType,
    type: string,
    callback: (params: CompilerListenerParameters) => void
  ) => void;
  removeEventListener: (
    source: EventSourceType,
    type: string,
    callback: (params: CompilerListenerParameters) => void
  ) => void;
  release: () => void;
  releaseGrammar: (removeGraphicItems: boolean) => void;
  // addGrammarItem: (grammarItem: IGrammarItem) => void;
  // removeGrammarItem: (grammarItem: IGrammarItem, reserveVGrammarModel?: boolean) => void;

  addRootMark: (mark: IMark) => any;
  removeRootMark: (mark: IMark) => any;
  getRootMarks: () => IMark[];

  updateLayoutTag: () => void;
  getLayoutState: () => LayoutState;
  getRootGroup: () => IGroup;
  getChart: () => IChart;
}

export interface ICompilable {
  /** 获取 compile 对象 */
  getCompiler: () => ICompiler;
  /** 获取 vgrammar view */
  getStage: () => IStage;

  /** 编译总入口 */
  compile: () => void;
  /** 编译所有 mark */
  compileMarks?: (group?: IGroup) => void;
  /** 编译所有 data */
  compileData?: () => void;

  /** 清除compile 内容入口 */
  clear?: () => void;

  /** 全部编译完成 lift circle */
  afterCompile?: () => void;

  /** 释放总入口 */
  release: () => void;
}

export interface ICompilableInitOption {
  /** 编译对象 应当由外部提供 */
  getCompiler: () => ICompiler;
}

export enum GrammarType {
  data = 'data',
  mark = 'mark'
}

export interface ITransformSpec {
  type: string;
  [key: string]: any;
}

export interface IGrammarItem extends ICompilable {
  id: number;
  /** 生成语法元素名称 */
  generateProductId: () => string;
  /** 获取语法元素名称 */
  getProductId: () => string;
  /** 删除已编译的语法元素 */
  removeProduct: (releaseDetach?: boolean) => void;
  // transform
  setTransform: (transform: ITransformSpec[]) => void;
}

export type GrammarItemInitOption = ICompilableInitOption;

export type GrammarItemCompileOption = Record<string, any>;

export type StateValueMap = Record<string, unknown>;
