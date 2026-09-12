import {
  BaseHistogramChart,
  Factory,
  getCartesianCrosshairRect,
  getCartesianDimensionInfo,
  getDimensionInfoByValue,
  HistogramChartSpecTransformer,
  registerDimensionEvents,
  registerDimensionHover,
  registerDimensionTooltipProcessor,
  registerGroupTooltipProcessor,
  registerMarkTooltipProcessor,
  type AdaptiveSpec
} from '@visactor/vchart';
import type { IHistogram3dChartSpec } from './interface';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { register3DPlugin } from '../3d/plugin';
import { registerBar3dSeries } from '../bar-3d/series';
import { registerLayout3d } from '../3d/layout';

export class Histogram3dChart<T extends IHistogram3dChartSpec> extends BaseHistogramChart<AdaptiveSpec<T, 'type'>> {
  static readonly type: string = ChartType3dEnum.histogram3d;
  static readonly seriesType: string = SeriesType3dEnum.bar3d;
  static readonly transformerConstructor = HistogramChartSpecTransformer;
  readonly transformerConstructor = HistogramChartSpecTransformer;
  readonly type: string = ChartType3dEnum.histogram3d;
  readonly seriesType: string = SeriesType3dEnum.bar3d;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}
export const registerHistogram3dChart = () => {
  registerGroupTooltipProcessor();
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  register3DPlugin();
  registerLayout3d();
  registerBar3dSeries();
  Factory.registerChart(Histogram3dChart.type, Histogram3dChart);
};
