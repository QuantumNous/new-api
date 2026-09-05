import { ChartTypeEnum } from '../interface/type';
import { SeriesTypeEnum } from '../../series/interface/type';
import { registerRangeAreaSeries } from '../../series/range-area/range-area';
import { Factory } from '../../core/factory';
import type { IRangeAreaChartSpec } from './interface';
import { RangeAreaChartSpecTransformer } from './range-area-transformer';
import { BaseChart } from '../base';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class RangeAreaChart<T extends IRangeAreaChartSpec = IRangeAreaChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.rangeArea;
  static readonly seriesType: string = SeriesTypeEnum.rangeArea;
  static readonly transformerConstructor = RangeAreaChartSpecTransformer;
  readonly transformerConstructor = RangeAreaChartSpecTransformer;
  readonly type: string = ChartTypeEnum.rangeArea;
  readonly seriesType: string = SeriesTypeEnum.rangeArea;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;

    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerRangeAreaChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerRangeAreaSeries();
  Factory.registerChart(RangeAreaChart.type, RangeAreaChart);
};
