import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IBoxPlotChartSpec } from './interface';
import { registerBoxplotSeries } from '../../series/box-plot/box-plot';
import { Factory } from '../../core/factory';
import { BoxPlotChartSpecTransformer } from './box-plot-transformer';
import { BaseChart } from '../base';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { boxplot } from '@visactor/vdataset';

export class BoxPlotChart<T extends IBoxPlotChartSpec = IBoxPlotChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.boxPlot;
  static readonly seriesType: string = SeriesTypeEnum.boxPlot;
  static readonly transformerConstructor = BoxPlotChartSpecTransformer;
  readonly transformerConstructor = BoxPlotChartSpecTransformer;
  readonly type: string = ChartTypeEnum.boxPlot;
  readonly seriesType: string = SeriesTypeEnum.boxPlot;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerBoxplotChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerBoxplotSeries();
  Factory.registerTransform('boxplot', boxplot);
  Factory.registerChart(BoxPlotChart.type, BoxPlotChart);
};
