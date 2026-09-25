import {
  BaseChart,
  Factory,
  getCartesianCrosshairRect,
  getCartesianDimensionInfo,
  getDimensionInfoByValue,
  registerDimensionEvents,
  registerDimensionHover,
  registerDimensionTooltipProcessor,
  registerMarkTooltipProcessor
} from '@visactor/vchart';
import { RangeColumn3dChartSpecTransformer } from './chart-spec-transformer';
import type { IRangeColumn3dChartSpec } from './interface';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { register3DPlugin } from '../3d/plugin';
import { registerRangeColumn3dSeries } from './series';
import { registerLayout3d } from '../3d/layout';

export class RangeColumn3dChart<T extends IRangeColumn3dChartSpec = IRangeColumn3dChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartType3dEnum.rangeColumn3d;
  static readonly seriesType: string = SeriesType3dEnum.rangeColumn3d;
  static readonly transformerConstructor = RangeColumn3dChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = RangeColumn3dChartSpecTransformer;
  readonly type: string = ChartType3dEnum.rangeColumn3d;
  readonly seriesType: string = SeriesType3dEnum.rangeColumn3d;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;

    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerRangeColumn3dChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  register3DPlugin();
  registerLayout3d();
  registerRangeColumn3dSeries();
  Factory.registerChart(RangeColumn3dChart.type, RangeColumn3dChart);
};
