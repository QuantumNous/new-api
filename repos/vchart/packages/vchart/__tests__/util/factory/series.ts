// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-empty-function */
import type { DataView, DataSet } from '@visactor/vdataset';
import type { IEvent } from '../../../src/event/interface';
import type { ILayoutPoint, ILayoutRect } from '../../../src/model/interface';
import type { IMark } from '../../../src/mark/interface';
import type {
  ILayoutModelState,
  IEffect,
  IModelOption,
  IModelInitOption,
  IModelLayoutOption,
  IModelEvaluateOption,
  IModelRenderOption
} from '../../../src/model/interface';
import type { IRegion } from '../../../src/region/interface';
import type { Group } from '../../../src/series/base/group';
import type { CoordinateType, IOrientType, IPoint } from '../../../src/typings';
import type {
  ISeries,
  ISeriesSeriesInfo,
  ISeriesStackDataNode,
  ISeriesUpdateDataOption
} from '../../../src/series/interface';
import type { TestRegion } from './region';
import { getTestCompiler } from './compiler';

// TODO series 部分对外接口返回值为null 用到再补充吧
export class TestSeries implements ISeries {
  type: string;
  name?: string;
  state: ILayoutModelState;
  stackNormalize: boolean;
  dataSet: DataSet;

  _rawData: DataView;
  _rawDataStatisticsData: DataView;
  _viewData: DataView;
  _viewDataStatisticsData: DataView;
  _region: TestRegion;

  constructor(type: string, opt?: any) {
    this.type = type;
    this._region = opt.region;
    if (opt) {
      Object.keys(opt).forEach(k => {
        this[k] = opt[k];
      });
    }
  }
  getCompiler() {
    return getTestCompiler();
  }
  getSpec() {}
  coordinate: CoordinateType;
  getRawData(): DataView {
    return this._rawData;
  }
  getViewData(level?: number): DataView {
    return this._viewData;
  }
  getRawDataStatistics?(): DataView {
    return this._rawDataStatisticsData;
  }
  getViewDataStatistics?(): DataView {
    return this._viewDataStatisticsData;
  }
  updateRawData(d: any, opt: ISeriesUpdateDataOption): void {}
  setData?(dv: DataView): void {}
  rawDataUpdate(d: DataView): void {}
  viewDataUpdate(d: DataView): void {}
  viewDataStatisticsUpdate(d: DataView): void {}
  getRegion(): IRegion {
    return this._region;
  }
  initMark(): void {}
  getMarks(): IMark[] {
    return [];
  }
  getMarksInType(type: string): IMark[] {
    return [];
  }
  getMarkInName(name: string): IMark {
    return null;
  }
  getMarkInId(id: number): IMark {
    return null;
  }
  addMark(m: IMark): void {}
  removeMark(id: number): void {}
  initSeriesStyle(markName: string, cb: (spec: any, groupBy: string) => void): void {}
  getStackData(): ISeriesStackDataNode {
    return null;
  }
  getStackValueField(): string {
    return null;
  }
  setValueFieldToStack(): void {}
  getStackGroupFields(): string[] {
    return [];
  }
  getSeriesField(): string {
    return null;
  }
  getSeriesKeys(): string[] {
    return null;
  }
  getSeriesInfoList(): ISeriesSeriesInfo[] {
    return null;
  }
  getGroups(): Group {
    return null;
  }
  getDimensionField(): string[] {
    return null;
  }
  getMeasureField(): string[] {
    return null;
  }
  setSeriesField(field: string): void {}
  modelType: string;
  specKey: string;
  specIndex: number;
  id: number;
  userId?: string;
  marks?: IMark[];
  event: IEvent;
  effect: IEffect;
  getOption(): IModelOption {
    return null;
  }
  compile(spec: any, ctx: any): void {}
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
  } {
    return { change: false, reRender: false, reSize: false, reCompile: false };
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
  layoutZindex: number;
  chartLayoutRect: ILayoutRect;
  setLayoutRect: (rect: Partial<ILayoutRect>) => void;
  computeBoundsInRect: (rect: ILayoutRect) => ILayoutRect;
  setLayoutStartPosition(pos?: Partial<IPoint>): void {}
  updateLayoutAttribute(): void {}
}
