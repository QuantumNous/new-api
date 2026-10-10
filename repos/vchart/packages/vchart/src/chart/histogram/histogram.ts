import { registerBarSeries } from '../../series/bar/bar';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import { BaseHistogramChart } from './base/base';
import { Factory } from '../../core/factory';
import type { IHistogramChartSpec } from './interface';
import { HistogramChartSpecTransformer } from './histogram-transformer';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';
import { bin } from '@visactor/vdataset';

export class HistogramChart<T extends IHistogramChartSpec = IHistogramChartSpec> extends BaseHistogramChart<T> {
  static readonly type: string = ChartTypeEnum.histogram;
  static readonly seriesType: string = SeriesTypeEnum.bar;
  static readonly transformerConstructor = HistogramChartSpecTransformer;
  readonly transformerConstructor = HistogramChartSpecTransformer;
  readonly type: string = ChartTypeEnum.histogram;
  readonly seriesType: string = SeriesTypeEnum.bar;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerHistogramChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerBarSeries();
  Factory.registerTransform('bin', bin);
  Factory.registerChart(HistogramChart.type, HistogramChart);
};
