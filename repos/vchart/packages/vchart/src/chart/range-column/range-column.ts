import { ChartTypeEnum } from '../interface/type';
import { SeriesTypeEnum } from '../../series/interface/type';
import type { IRangeColumnChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { registerRangeColumnSeries } from '../../series/range-column/range-column';
import { RangeColumnChartSpecTransformer } from './range-column-transformer';
import { BaseChart } from '../base';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class RangeColumnChart<T extends IRangeColumnChartSpec = IRangeColumnChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.rangeColumn;
  static readonly seriesType: string = SeriesTypeEnum.rangeColumn;
  static readonly transformerConstructor = RangeColumnChartSpecTransformer;
  readonly transformerConstructor = RangeColumnChartSpecTransformer;
  readonly type: string = ChartTypeEnum.rangeColumn;
  readonly seriesType: string = SeriesTypeEnum.rangeColumn;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;

    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerRangeColumnChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerRangeColumnSeries();
  Factory.registerChart(RangeColumnChart.type, RangeColumnChart);
};
