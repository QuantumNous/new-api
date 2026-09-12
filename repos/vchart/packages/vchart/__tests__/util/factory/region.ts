// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-empty-function */
import type { BaseEventParams, IEvent } from '../../../src/event/interface';
import type { IInteraction } from '../../../src/interaction/interface';
import type { ILayoutPoint, ILayoutRect } from '../../../src/model/interface';
import type { IMark, IMarkRaw, IMarkStyle } from '../../../src/mark/interface';
// eslint-disable-next-line no-duplicate-imports
import type {
  IEffect,
  IModelOption,
  IModelInitOption,
  IModelLayoutOption,
  IModelEvaluateOption,
  IModelRenderOption
} from '../../../src/model/interface';
import type { ISeries } from '../../../src/series/interface';
import type {
  ConvertToMarkStyleSpec,
  CoordinateType,
  ICommonSpec,
  IOrientType,
  IPoint,
  IRect
} from '../../../src/typings';
import { array, isValid } from '../../../src/util';
import type { IRegion } from '../../../src/region/interface';
import type { IAnimate } from '../../../src/animation/interface';
import type { ITooltipHelper } from '../../../src/model/tooltip-helper';
import type { StateValue, StateValueType } from '../../../src/compile/mark';
import type { ModelStateManager } from '../../../src/model/model-state-manager';
// import type {
//   IElement,
//   IGroupMark as IVGRrammarGroupMark,
//   IMark as IVGRrammarMark,
//   IView
// } from '@visactor/vgrammar-core';
import type { Compiler } from '../../../src/compile/compiler';
import type { ICompilableData } from '../../../src/compile/data';
import type { IBoundsLike } from '@visactor/vutils';
import type { IGroupMark } from '../../../src/mark/group';
import type { IChart } from '../../../src/chart/interface';

type IView = any;
type IGroupMark = any;
type IElement = any;
type IVGRrammarGroupMark = any;
type IVGRrammarMark = any;

export class TestRegion implements IRegion {
  state: ModelStateManager;
  interaction: IInteraction = {
    registerMark: (state: StateValue, mark: IMark) => {},
    filterEventMark: (params: BaseEventParams, state: StateValue) => false,
    getStateMark: (state: StateValue) => [],

    getEventElement: (stateValue: StateValue) => [],
    getEventElementData: (stateValue: StateValue) => [],
    addEventElement: (stateValue: StateValue, element: IElement) => {},
    removeEventElement: (stateValue: StateValue, elements: IElement) => {},
    exchangeEventElement: (stateValue: StateValue, elements: IElement) => {},
    clearEventElement: (stateValue: StateValue, clearReverse: boolean) => {},
    reverseEventElement: (stateValue: StateValue) => {}
  };
  coordinate: CoordinateType = 'cartesian';
  _series: ISeries[] = [];

  constructor(opt?: any) {
    if (opt) {
      Object.keys(opt).forEach(k => {
        this[k] = opt[k];
      });
    }
  }
  getChart: () => IChart;
  absoluteLayoutInRect: (rect: IRect) => void;
  getGroupMark: () => IGroupMark;
  getVGrammarView: () => IView;
  getLastComputeOutBounds: () => IBoundsLike;
  getAutoIndent: () => boolean;
  getLastComputeBoundsInGlobal: () => IBoundsLike;
  compileMarks?: ((group?: string | IVGRrammarGroupMark | undefined) => void) | undefined;
  compileData?: (() => void) | undefined;
  compileSignal?: (() => void) | undefined;
  getData: () => ICompilableData;
  getState: () => { [key: string]: unknown; layoutUpdateRank: number };
  getCompiler: () => Compiler;
  bindSceneNode: (node: IElement) => void;
  getSceneNodes: () => IElement[];
  getSceneNodeMarks: () => IVGRrammarMark[];
  release: () => void;
  animate?: IAnimate | undefined;
  reInit: (spec?: any) => void;
  getSpec?: (() => any) | undefined;
  setMarkStyle: <T extends ICommonSpec>(
    mark?: IMarkRaw<T>,
    style?: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>,
    state?: StateValueType,
    level?: number
  ) => void;

  addSeries(s: ISeries) {
    if (!s) {
      return;
    }
    if (!this._series.includes(s)) {
      this._series.push(s);
    }
  }

  removeSeries(s: ISeries) {
    if (!s) {
      return;
    }
    const index = this._series.findIndex(s_ => s_ === s);
    if (index >= 0) {
      this._series.splice(index, 1);
    }
  }

  getSeries(
    opt: {
      name?: string;
      userId?: string | string[];
      specIndex?: number | number[];
      id?: number;
      type?: string;
      coordinateType?: CoordinateType;
      dataName?: string;
    } = {}
  ): ISeries[] {
    return this._series.filter(
      s =>
        (opt.name ? s?.name === opt.name : true) &&
        (opt.userId ? (s.userId ? array(opt.userId).includes(s.userId) : false) : true) &&
        // (opt.userId && s.userId ? array(opt.userId).includes(s.userId) : true) &&
        (isValid(opt.specIndex) && s.getSpecIndex ? array(opt.specIndex).includes(s.getSpecIndex()) : true) &&
        (opt.id ? s.id === opt.id : true) &&
        (opt.type ? s.type === opt.type : true) &&
        (opt.coordinateType ? s.coordinate === opt.coordinateType : true) &&
        (opt.dataName ? s.getRawData?.()?.name === opt.dataName : true)
    );
  }

  getSeriesInName(name: string): ISeries {
    return this.getSeries({ name })[0];
  }
  getSeriesInUserId(userId: string): ISeries {
    return this.getSeries({ userId })[0];
  }
  getSeriesInId(id: number): ISeries {
    return this.getSeries({ id })[0];
  }
  getSeriesInType(type: string): ISeries[] {
    return this.getSeries({ type });
  }
  getSeriesInCoordinateType(type: CoordinateType): ISeries[] {
    return this.getSeries({ type });
  }
  getSeriesInDataName(dataName: string): ISeries[] {
    return this.getSeries({ dataName });
  }
  getMarks(): IMark[] {
    throw new Error('Method not implemented.');
  }
  modelType: string;
  type: string;
  specKey: string;
  specIndex: number;
  id: number;
  userId?: string;
  marks?: IMark[];
  event: IEvent;
  effect: IEffect;
  getOption(): IModelOption {
    return null as any;
  }
  compile(): void {}
  created(): void {}
  init(option: IModelInitOption): void {}
  onLayoutStart(ctx: IModelLayoutOption): void {}
  onLayoutEnd(ctx: IModelLayoutOption): void {}
  onEvaluateEnd(ctx: IModelEvaluateOption): void {}
  onRender(ctx: IModelRenderOption): void {}
  onDestroy(): void {}
  updateSpec(spec: any): {
    change: boolean;
    reRender: boolean;
    reSize: boolean;
    reCompile: boolean;
    reMake: boolean;
  } {
    return {
      change: false,
      reRender: false,
      reSize: false,
      reCompile: false,
      reMake: false
    };
  }
  getSpecIndex(): number {
    return this.specIndex;
  }
  layoutClip: boolean;
  getLayoutStartPoint: () => ILayoutPoint;
  getLayoutRect: () => ILayoutRect;
  layoutType: 'region-relative' | 'region' | 'normal' | 'absolute';
  layoutBindRegionID: number | number[];
  layoutOrient: IOrientType;
  layoutPaddingLeft: number;
  layoutPaddingTop: number;
  layoutPaddingRight: number;
  layoutPaddingBottom: number;
  layoutOffsetX: number;
  layoutOffsetY: number;
  layoutLevel: number;
  layoutAbsoluteLeft: number;
  layoutAbsoluteTop: number;
  layoutAbsoluteRight: number;
  layoutAbsoluteBottom: number;
  layoutZIndex: number;
  chartLayoutRect: ILayoutRect;
  setLayoutRect(rect: Partial<ILayoutRect>): void {}
  computeBoundsInRect(rect: ILayoutRect) {
    return { width: 100, height: 100 };
  }
  setLayoutStartPosition(pos?: Partial<IPoint>): void {}
  updateLayoutAttribute(): void {}
  initMarkStyleWithSpec(mark?: IMark, spec?: any, key?: string): void {}
  tooltipHelper: ITooltipHelper;
}
