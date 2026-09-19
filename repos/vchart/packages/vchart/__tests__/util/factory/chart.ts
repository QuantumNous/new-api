import { ChartData } from './../../../src/chart/chart-meta/data';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { GlobalScale } from '../../../src/scale/global-scale';
import type { IGlobalScale } from '../../../src/scale/interface';
/* eslint-disable @typescript-eslint/no-empty-function */
import type { IRegionSpec, IRegion } from '../../../src/region/interface';
import type { IParserOptions } from '@visactor/vdataset';
import type { IComponent } from '../../../src/component/interface';
import type { IModel, IUpdateSpecResult } from '../../../src/model/interface';
import type { IMark } from '../../../src/mark/interface';
import type { ISeries } from '../../../src/series/interface';
import type {
  IChart,
  IChartEvaluateOption,
  IChartInitOption,
  IChartLayoutOption,
  IChartRenderOption,
  ILayoutParams
} from '../../../src/chart/interface';
import type {
  Datum,
  ILayoutOrientPadding,
  ILayoutRect,
  IMarkStateSpec,
  ISeriesSpec,
  MaybeArray,
  StringOrNumber
} from '../../../src/typings';
import { TestRegion } from './region';
import { TestSeries } from './series';
import { DataSet } from '@visactor/vdataset';
import { getTestCompiler } from './compiler';
// import type { IView, IGroupMark } from '@visactor/vgrammar-core';
import type { IBoundsLike } from '@visactor/vutils';
import type { ITheme } from '../../../src/theme';
import type { LayoutCallBack } from '../../../src/layout/interface';
// eslint-disable-next-line no-duplicate-imports
import type { IRegionQuerier } from '../../../src/typings';

type IView = any;
type IGroupMark = any;

export class TestChart implements IChart {
  protected _spec: any;

  protected _chartData: ChartData;
  getChartData() {
    return this._chartData;
  }
  protected _regions: IRegion[] = [];
  protected _series: ISeries[] = [];
  protected _components: IComponent[] = [];
  _dataSet: DataSet;
  globalScale: IGlobalScale;

  constructor(spec: {
    /** 系列 */
    series?: ISeriesSpec[];
    /** region配置 */
    regions?: IRegionSpec[];
    /** component */
    components?: {
      type: string;
      id?: string;
    }[];
    dataSet: DataSet;
  }) {
    this._spec = spec;
    this._chartData = new ChartData(this._dataSet, null as any);
    this._chartData.parseData(this._spec.data);
    this._dataSet = spec.dataSet ?? new DataSet();
    if (spec.regions) {
      this._regions = spec.regions.map(rSpec => {
        return new TestRegion(rSpec);
      });
    }
    if (this._regions.length === 0) {
      this._regions.push(
        new TestRegion({
          specKey: 'region',
          specIndex: 0
        })
      );
    }

    if (spec.series) {
      this._series = spec.series.map((sSpec, i) => {
        let region: IRegion | undefined;
        if (sSpec.regionId) {
          region = this.getRegionsInUserId(sSpec.regionId);
        }
        if (!region) {
          region = this.getRegionsInIndex(sSpec.regionIndex ? [sSpec.regionIndex] : undefined)[0];
        }
        return new TestSeries(sSpec.type, {
          dataSet: this._dataSet,
          region,
          ...sSpec
        });
      });
    }

    if (spec.components) {
      this._components = spec.components.map(cSpec => {
        return {
          userId: cSpec.id || undefined,
          type: cSpec.type
        } as any;
      });
    }
    this.globalScale = new GlobalScale([], this as any);
  }
  setLayout: (layout: LayoutCallBack) => void;
  getRegionsInQuerier: (query: MaybeArray<IRegionQuerier>) => IRegion[];
  updateState: (
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: ((series: ISeries, mark: IMark, stateKey: string) => boolean) | undefined
  ) => void;
  setSelected: (
    datum: any,
    filter?: ((series: ISeries, mark: IMark) => boolean) | undefined,
    region?: IRegionQuerier | undefined
  ) => void;
  setHovered: (
    datum: MaybeArray<Datum> | null,
    filter?: ((series: ISeries, mark: IMark) => boolean) | undefined,
    region?: IRegionQuerier | undefined
  ) => void;
  getVGrammarView: () => IView;
  getLayoutTag: () => boolean;
  setLayoutTag: (tag: boolean) => boolean;
  updateParseData: (id: string, data: Datum[], options?: IParserOptions | undefined) => void;
  onLayout: (view: IView) => void;
  getComponentByUserId: (user_id: string) => IComponent | undefined;
  updateSpec: (spec: any) => IUpdateSpecResult;
  updateViewBox: (viewBox: IBoundsLike) => void;
  getCanvas: () => HTMLCanvasElement | undefined;
  getCurrentTheme: () => ITheme;
  setCurrentTheme: (theme: ITheme, noRender?: boolean | undefined) => void;
  compile: () => void;
  compileMarks?: ((group?: string | IGroupMark | undefined) => void) | undefined;
  compileData?: (() => void) | undefined;
  compileSignal?: (() => void) | undefined;
  release: () => void;

  padding: ILayoutOrientPadding;
  getCompiler() {
    return getTestCompiler();
  }
  type: string = 'common';
  getCanvasRect(): ILayoutRect {
    return { width: 500, height: 500 };
  }
  layout(context: ILayoutParams): void {}
  updateData(id: string, data: any, options?: IParserOptions): void {}
  created(): void {}
  init(option: IChartInitOption): void {}
  onLayoutStart(ctx: IChartLayoutOption): void {}
  onLayoutEnd(ctx: IChartLayoutOption): void {}
  onEvaluateEnd(ctx: IChartEvaluateOption): void {}
  onRender(ctx: IChartRenderOption): void {}
  onDestroy(): void {}
  onResize(width: number, height: number): void {}

  // 区域
  getRegionsInIndex = (index?: number[]): IRegion[] => {
    if (!index || index.length === 0) {
      return [this._regions[0]];
    }
    return this._regions.filter((_r, i) => index.includes(i));
  };
  getAllRegions() {
    return this._regions;
  }
  getRegionsInIds = (ids: number[]): IRegion[] => {
    if (!ids) {
      return [];
    }
    return this._regions.filter(r => ids.includes(r.id));
  };

  getRegionsInUserId = (userId: StringOrNumber): IRegion | undefined => {
    if (!userId) {
      return undefined;
    }
    return this._regions.find(r => r.userId === userId);
  };

  getRegionsInUserIdOrIndex = (userIds?: StringOrNumber[], index?: number[]): IRegion[] => {
    const regions = this.getAllRegion();
    return regions.filter(r => {
      if (userIds?.length) {
        return r.userId && userIds.includes(r.userId);
      } else if (index?.length) {
        return index.includes(r.getSpecIndex());
      }
      return true;
    });
  };

  // 模块
  getComponents(): IModel[] {
    return this._components;
  }

  // series
  getAllSeries(): ISeries[] {
    return this._series;
  }
  getSeriesInIndex = (index?: number[]): ISeries[] => {
    if (!index || index.length === 0) {
      return [this._series[0]];
    }
    return this._series.filter((_r, i) => index.includes(i));
  };
  getSeriesInIds = (ids?: number[]): ISeries[] => {
    if (!ids) {
      return [];
    }
    return this._series.filter(r => ids.includes(r.id));
  };

  getSeriesInUserId = (userId: StringOrNumber): ISeries | undefined => {
    if (!userId) {
      return undefined;
    }
    return this._series.find(r => r.userId === userId);
  };

  getSeriesInUserIdOrIndex = (userIds?: StringOrNumber[], index?: number[]): ISeries[] => {
    const series = this.getAllSeries();
    return series.filter(s => {
      if (userIds?.length) {
        return s.userId && userIds.includes(s.userId);
      } else if (index?.length) {
        return index.includes(s.getSpecIndex());
      }
      return true;
    });
  };

  getAllComponents(): IComponent[] {
    return this._components;
  }

  getComponentByIndex = (key: string, index: number) => {
    const components = this._components.filter(c => c.specKey === key);
    if (!components || components.length === 0) {
      return undefined;
    }
    return components[index];
  };
  getComponentsByKey = (key: string) => {
    return this._components.filter(c => c.specKey === key);
  };

  getModelById(id: number): IModel | undefined {
    return undefined;
  }

  getModelByUserId(userId: StringOrNumber): IModel | undefined {
    // TODO: 考虑通过 map 结构优化获取方式 & 补充所有 model 的寻找方法
    const series = this._series.find(s => s.userId === userId);
    if (series) {
      return series;
    }
    const region = this._regions.find(s => s.userId === userId);
    if (region) {
      return region;
    }
    const component = this._components.find(s => s.userId === userId);
    if (component) {
      return component;
    }
    return undefined;
  }

  getMarkById(id: number): IMark | undefined {
    return undefined;
  }

  getOption() {
    return {} as any;
  }
}
